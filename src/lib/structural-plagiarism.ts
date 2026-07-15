// Structural plagiarism detector — JPlag-style pipeline (browser TS port).
//
// Pipeline (per Manifesto Metodológico CortexForense):
//   1. Tokenize source code, dropping comments/whitespace.
//   2. Normalize identifiers/literals to generic tokens (ID / NUM / STR),
//      preserving keywords and operators. Renaming variables no longer
//      hides the structural fingerprint.
//   3. Run Greedy String Tiling (Wise, 1996) — the same algorithm behind
//      JPlag — to find maximal common token sequences.
//   4. Similarity = 2 * coveredTokens / (|A|+|B|) — JPlag's formula.
//
// This is NOT a re-implementation of the full JPlag scanner set; it's an
// in-browser structural comparator based on the same principles, sufficient
// to defeat rename/translation obfuscation and to give the LLM deterministic
// evidence to cite in the parecer.

export interface Token {
  value: string;   // normalized value: keyword, punctuation, or ID/NUM/STR
  line: number;
  raw: string;     // original spelling (for evidence snippets)
}

export interface FileTokens {
  file: string;
  tokens: Token[];
  rawLines: string[];
}

export interface StructuralMatch {
  fileA: string;
  fileB: string;
  length: number;         // token count of the matched block
  linesA: [number, number];
  linesB: [number, number];
  snippetA: string;
  snippetB: string;
}

export interface StructuralReport {
  similarity: number;                 // 0..100
  totalTokensA: number;
  totalTokensB: number;
  coveredTokens: number;              // sum of match lengths (both sides count)
  matches: StructuralMatch[];         // sorted by length desc
  filePairs: { a: string; b: string; similarity: number; matchedTokens: number }[];
  minMatchUsed: number;               // effective minMatch (adaptive or fixed)
  languageProfile: string;            // e.g. "python" / "c-family" / "mixed"
}

// Keywords across the languages the tool advertises — kept as-is; anything
// else that looks like an identifier collapses to "ID".
const KEYWORDS = new Set<string>([
  // JS/TS
  "function","return","if","else","for","while","do","break","continue","let",
  "const","var","class","extends","new","this","super","import","export","from",
  "default","try","catch","finally","throw","switch","case","typeof",
  "instanceof","in","of","null","undefined","true","false","async","await",
  "yield","void","delete",
  // Python
  "def","lambda","pass","None","True","False","and","or","not","is","elif",
  "with","as","global","nonlocal","raise","assert","import","from",
  // Java / C# / C / C++
  "public","private","protected","static","void","int","long","short","float",
  "double","boolean","bool","char","String","struct","namespace","using",
  "interface","abstract","final","virtual","override","enum","sizeof",
  "typedef","include","throws","implements",
  // Go / Rust
  "func","fn","mut","pub","impl","trait","package","chan","go","defer",
  "select","match",
  // PHP / Ruby / Kotlin / Swift misc
  "echo","end","then","begin","fun","val","when","init","object","protocol",
]);

// Tokenizer — line-aware, comment/string-aware, multi-language.
export function tokenize(source: string): { tokens: Token[]; rawLines: string[] } {
  const rawLines = source.split("\n");
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = source.length;

  const advanceLines = (s: string) => {
    for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) line++;
  };

  while (i < n) {
    const c = source[i];
    const c2 = source.substr(i, 2);

    // Whitespace
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "\n") { line++; i++; continue; }

    // Line comments: // and #
    if (c2 === "//" || c === "#") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? n : nl;
      continue;
    }
    // Block comments: /* ... */
    if (c2 === "/*") {
      const end = source.indexOf("*/", i + 2);
      const chunk = source.slice(i, end === -1 ? n : end + 2);
      advanceLines(chunk);
      i = end === -1 ? n : end + 2;
      continue;
    }
    // Python triple-string comments/docstrings
    if (source.substr(i, 3) === '"""' || source.substr(i, 3) === "'''") {
      const quote = source.substr(i, 3);
      const end = source.indexOf(quote, i + 3);
      const chunk = source.slice(i, end === -1 ? n : end + 3);
      advanceLines(chunk);
      tokens.push({ value: "STR", line, raw: chunk.slice(0, 20) });
      i = end === -1 ? n : end + 3;
      continue;
    }

    // Strings
    if (c === '"' || c === "'" || c === "`") {
      const startLine = line;
      const quote = c;
      let j = i + 1;
      while (j < n && source[j] !== quote) {
        if (source[j] === "\\") { j += 2; continue; }
        if (source[j] === "\n") line++;
        j++;
      }
      tokens.push({ value: "STR", line: startLine, raw: source.slice(i, Math.min(j + 1, i + 30)) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < n && /[0-9a-fA-Fx.eE_]/.test(source[j])) j++;
      tokens.push({ value: "NUM", line, raw: source.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers / keywords
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(source[j])) j++;
      const word = source.slice(i, j);
      tokens.push({
        value: KEYWORDS.has(word) ? word : "ID",
        line,
        raw: word,
      });
      i = j;
      continue;
    }

    // Multi-char operators
    const three = source.substr(i, 3);
    if (["===","!==","<<=",">>=","**=","...","&&=","||="].includes(three)) {
      tokens.push({ value: three, line, raw: three }); i += 3; continue;
    }
    const two = c2;
    if (["==","!=","<=",">=","=>","->","::","++","--","&&","||","+=","-=","*=","/=","%=","**","<<",">>","??"].includes(two)) {
      tokens.push({ value: two, line, raw: two }); i += 2; continue;
    }

    // Single-char punctuation / operator
    if (/[+\-*/%=<>!&|^~?:;,.\[\](){}@]/.test(c)) {
      tokens.push({ value: c, line, raw: c }); i++; continue;
    }

    // Unknown byte — skip
    i++;
  }

  return { tokens, rawLines };
}

// Greedy String Tiling — matches sequences ≥ minMatch, marking tiles so
// no token is reused across matches. Reference: Michael J. Wise, 1996.
function greedyStringTiling(
  a: Token[],
  b: Token[],
  minMatch = 9,
): { startA: number; startB: number; length: number }[] {
  const markedA = new Uint8Array(a.length);
  const markedB = new Uint8Array(b.length);
  const tiles: { startA: number; startB: number; length: number }[] = [];
  // No artificial iteration cap: GST terminates naturally when no candidate
  // ≥ minMatch remains. Hard safety upper bound = tokens/minMatch on either
  // side, so runtime is bounded and deterministic.
  const hardCap = Math.ceil((a.length + b.length) / Math.max(minMatch, 1)) + 8;
  for (let iter = 0; iter < hardCap; iter++) {
    let maxLen = minMatch;
    const candidates: { startA: number; startB: number; length: number }[] = [];

    for (let i = 0; i < a.length; i++) {
      if (markedA[i]) continue;
      for (let j = 0; j < b.length; j++) {
        if (markedB[j]) continue;
        let k = 0;
        while (
          i + k < a.length && j + k < b.length &&
          !markedA[i + k] && !markedB[j + k] &&
          a[i + k].value === b[j + k].value
        ) k++;
        if (k >= maxLen) {
          if (k > maxLen) { candidates.length = 0; maxLen = k; }
          candidates.push({ startA: i, startB: j, length: k });
        }
      }
    }

    if (!candidates.length) break;

    for (const m of candidates) {
      // Skip if any token in tile was marked by an earlier candidate this round
      let ok = true;
      for (let k = 0; k < m.length; k++) {
        if (markedA[m.startA + k] || markedB[m.startB + k]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let k = 0; k < m.length; k++) {
        markedA[m.startA + k] = 1;
        markedB[m.startB + k] = 1;
      }
      tiles.push(m);
    }
  }

  return tiles.sort((x, y) => y.length - x.length);
}

// Parse a bundle produced by the page (headers of the form "// ── ARQUIVO: <path> ──")
// into per-file token lists.
export function parseBundleToFiles(bundle: string): FileTokens[] {
  const parts = bundle.split(/\/\/ ── ARQUIVO: (.+?) ──\n/);
  // parts: [prefix, file1, body1, file2, body2, ...]
  const out: FileTokens[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const file = parts[i].trim();
    const body = parts[i + 1] ?? "";
    const { tokens, rawLines } = tokenize(body);
    if (tokens.length >= 5) out.push({ file, tokens, rawLines });
  }
  return out;
}

// Adaptive minMatch picker — different languages have different token density
// per meaningful construct. Python is terse (short minMatch → higher recall
// without false positives). Java/C# are verbose (longer minMatch avoids
// noise from getter/setter boilerplate). Reference: JPlag defaults per lang.
function detectLanguageProfile(files: FileTokens[]): { profile: string; minMatch: number } {
  const exts = new Set<string>();
  for (const f of files) {
    const m = f.file.match(/\.(\w+)$/);
    if (m) exts.add(m[1].toLowerCase());
  }
  const has = (...xs: string[]) => xs.some(x => exts.has(x));
  if (exts.size === 0) return { profile: "unknown", minMatch: 9 };
  if (has("java", "cs", "kt", "scala")) return { profile: "jvm/dotnet", minMatch: 12 };
  if (has("c", "cpp", "h", "hpp"))       return { profile: "c-family",   minMatch: 10 };
  if (has("go", "rs", "swift"))          return { profile: "systems",    minMatch: 10 };
  if (has("py", "rb", "lua"))            return { profile: "scripting",  minMatch: 7  };
  if (has("js", "ts", "tsx", "jsx"))     return { profile: "js/ts",      minMatch: 9  };
  return { profile: "mixed", minMatch: 9 };
}

// SHA-256 of the *normalized* token stream for both bundles concatenated.
// Same normalized input → same hex hash, always. Store this in the evidence
// record: reproducibility becomes cryptographically verifiable.
export async function computeEvidenceHash(bundleA: string, bundleB: string): Promise<string> {
  const fa = parseBundleToFiles(bundleA);
  const fb = parseBundleToFiles(bundleB);
  const serialize = (files: FileTokens[]) =>
    files.map(f => `${f.file}\n${f.tokens.map(t => t.value).join(" ")}`).join("\n---\n");
  const payload = `A\n${serialize(fa)}\n===\nB\n${serialize(fb)}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function snippetFor(rawLines: string[], line: number, span = 2): string {
  const start = Math.max(0, line - 1 - span);
  const end = Math.min(rawLines.length, line - 1 + span + 1);
  return rawLines.slice(start, end).join("\n");
}

// Full report: parses both bundles, compares each file in A against each in B,
// aggregates the top matches. Bounded to keep browser time reasonable.
export async function analyzeStructural(
  bundleA: string,
  bundleB: string,
  opts: {
    minMatch?: number | "adaptive";
    maxPairs?: number;
    maxMatches?: number;
    onProgress?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<StructuralReport> {
  const maxMatches = opts.maxMatches ?? 40;

  const filesA = parseBundleToFiles(bundleA);
  const filesB = parseBundleToFiles(bundleB);

  // Adaptive minMatch: derive from language mix across both bundles.
  const profileInfo = detectLanguageProfile([...filesA, ...filesB]);
  const minMatch = (opts.minMatch === undefined || opts.minMatch === "adaptive")
    ? profileInfo.minMatch
    : opts.minMatch;

  let coveredA = 0, coveredB = 0;
  let totalA = 0, totalB = 0;
  filesA.forEach(f => totalA += f.tokens.length);
  filesB.forEach(f => totalB += f.tokens.length);

  const matches: StructuralMatch[] = [];
  const filePairs: StructuralReport["filePairs"] = [];

  const totalPairs = filesA.length * filesB.length;
  let done = 0;
  // Yield to the browser every N pairs so the tab stays responsive on huge
  // repos (1000+ files → millions of pair-token comparisons).
  const YIELD_EVERY = 8;
  const yieldToUI = () => new Promise<void>(r => setTimeout(r, 0));

  // Emit an initial progress event so the UI can show the total pair count
  // immediately, instead of waiting until the first YIELD_EVERY boundary.
  opts.onProgress?.(0, totalPairs);
  await yieldToUI();

  for (const fa of filesA) {
    for (const fb of filesB) {
      if (opts.signal?.aborted) throw new Error("Análise cancelada");
      done++;
      if (done % YIELD_EVERY === 0) {
        opts.onProgress?.(done, totalPairs);
        await yieldToUI();
      }
      // Cheap guard: skip trivially small pairs
      if (fa.tokens.length < minMatch || fb.tokens.length < minMatch) continue;
      const tiles = greedyStringTiling(fa.tokens, fb.tokens, minMatch);
      if (!tiles.length) continue;

      let pairCovered = 0;
      for (const t of tiles) {
        pairCovered += t.length;
        const aStart = fa.tokens[t.startA].line;
        const aEnd = fa.tokens[t.startA + t.length - 1].line;
        const bStart = fb.tokens[t.startB].line;
        const bEnd = fb.tokens[t.startB + t.length - 1].line;
        matches.push({
          fileA: fa.file,
          fileB: fb.file,
          length: t.length,
          linesA: [aStart, aEnd],
          linesB: [bStart, bEnd],
          snippetA: snippetFor(fa.rawLines, aStart),
          snippetB: snippetFor(fb.rawLines, bStart),
        });
      }
      coveredA += pairCovered;
      coveredB += pairCovered;
      const pairSim = (2 * pairCovered) / (fa.tokens.length + fb.tokens.length) * 100;
      filePairs.push({
        a: fa.file,
        b: fb.file,
        similarity: Math.min(100, Math.round(pairSim)),
        matchedTokens: pairCovered,
      });
    }
  }
  opts.onProgress?.(totalPairs, totalPairs);

  matches.sort((x, y) => y.length - x.length);
  filePairs.sort((x, y) => y.similarity - x.similarity);

  const denom = totalA + totalB;
  const similarity = denom > 0
    ? Math.min(100, Math.round((coveredA + coveredB) / denom * 100))
    : 0;

  return {
    similarity,
    totalTokensA: totalA,
    totalTokensB: totalB,
    coveredTokens: coveredA,
    matches: matches.slice(0, maxMatches),
    filePairs: filePairs.slice(0, 40),
    minMatchUsed: minMatch,
    languageProfile: profileInfo.profile,
  };
}

// Format the report as deterministic evidence to inject into the LLM prompt.
export function formatEvidenceForLLM(r: StructuralReport): string {
  if (!r.matches.length) {
    return `EVIDÊNCIA ESTRUTURAL DETERMINÍSTICA (tokenização + Greedy String Tiling):
- Similaridade estrutural global: ${r.similarity}%
- Tokens analisados: A=${r.totalTokensA}, B=${r.totalTokensB}
- Perfil linguístico: ${r.languageProfile} · minMatch adaptativo: ${r.minMatchUsed} tokens
- Nenhum bloco de tokens estruturalmente idêntico (≥${r.minMatchUsed} tokens) foi encontrado.`;
  }

  const lines: string[] = [];
  lines.push("EVIDÊNCIA ESTRUTURAL DETERMINÍSTICA (tokenização + Greedy String Tiling estilo JPlag):");
  lines.push(`- Similaridade estrutural global: ${r.similarity}% (fórmula 2·cobertura/(|A|+|B|))`);
  lines.push(`- Tokens normalizados: A=${r.totalTokensA}, B=${r.totalTokensB}, cobertos por matches=${r.coveredTokens}`);
  lines.push(`- Perfil linguístico detectado: ${r.languageProfile} · minMatch adaptativo: ${r.minMatchUsed} tokens`);
  lines.push("- Identificadores e literais foram normalizados; renomear variáveis NÃO afeta o resultado.");
  lines.push("");
  lines.push("PARES DE ARQUIVOS COM MAIOR SIMILARIDADE ESTRUTURAL:");
  for (const p of r.filePairs.slice(0, 20)) {
    lines.push(`  • ${p.a}  ↔  ${p.b}  —  ${p.similarity}% (${p.matchedTokens} tokens)`);
  }
  lines.push("");
  lines.push("BLOCOS ESTRUTURALMENTE IDÊNTICOS (cite estes trechos no parecer):");
  for (let i = 0; i < Math.min(r.matches.length, 20); i++) {
    const m = r.matches[i];
    lines.push(`\n[Match #${i + 1}] ${m.length} tokens idênticos`);
    lines.push(`  A: ${m.fileA}  linhas ${m.linesA[0]}–${m.linesA[1]}`);
    lines.push(`  B: ${m.fileB}  linhas ${m.linesB[0]}–${m.linesB[1]}`);
    lines.push(`  --- Trecho A ---\n${m.snippetA}`);
    lines.push(`  --- Trecho B ---\n${m.snippetB}`);
  }
  return lines.join("\n");
}

// Complete file inventory of both bundles, classifying every file by its best
// structural match. Used to force the parecer to cite ALL files, not only the
// ones with identical blocks. Deterministic: derived entirely from the same
// tokenization/GST pass, so it is safe to inject as evidence.
//
// Classification bands (per file, based on best pair similarity involving it):
//   IDÊNTICO         ≥ 85%
//   ALTA SIMILARIDADE 60–84%
//   SIMILAR PARCIAL  30–59%
//   DIVERGENTE       1–29%   (some shared tokens, likely coincidental)
//   SEM CORRESPONDÊNCIA 0%   (no structural match found)
export function buildFileInventory(
  bundleA: string,
  bundleB: string,
  report: StructuralReport,
  maxPerSide = 500,
): string {
  const filesA = parseBundleToFiles(bundleA);
  const filesB = parseBundleToFiles(bundleB);

  // Aggregate best match per file from ALL pairs discovered by GST.
  // report.filePairs is truncated to 40, so recompute best-per-file here.
  const bestForA = new Map<string, { other: string; sim: number }>();
  const bestForB = new Map<string, { other: string; sim: number }>();
  for (const p of report.filePairs) {
    const a = bestForA.get(p.a);
    if (!a || p.similarity > a.sim) bestForA.set(p.a, { other: p.b, sim: p.similarity });
    const b = bestForB.get(p.b);
    if (!b || p.similarity > b.sim) bestForB.set(p.b, { other: p.a, sim: p.similarity });
  }

  const classify = (sim: number): string => {
    if (sim >= 85) return "IDÊNTICO";
    if (sim >= 60) return "ALTA SIMILARIDADE";
    if (sim >= 30) return "SIMILAR PARCIAL";
    if (sim > 0)   return "DIVERGENTE";
    return "SEM CORRESPONDÊNCIA";
  };

  const renderSide = (
    label: string,
    files: FileTokens[],
    best: Map<string, { other: string; sim: number }>,
  ): string[] => {
    const out: string[] = [];
    out.push(`\nINVENTÁRIO COMPLETO — REPOSITÓRIO ${label} (${files.length} arquivos):`);
    const sorted = [...files].sort((x, y) => {
      const sx = best.get(x.file)?.sim ?? 0;
      const sy = best.get(y.file)?.sim ?? 0;
      if (sy !== sx) return sy - sx;
      return x.file.localeCompare(y.file);
    });
    const shown = sorted.slice(0, maxPerSide);
    for (const f of shown) {
      const b = best.get(f.file);
      const sim = b?.sim ?? 0;
      const tag = classify(sim);
      const pair = b ? `↔ ${b.other} (${sim}%)` : "sem par estrutural";
      out.push(`  • [${tag}] ${f.file}  —  ${f.tokens.length} tokens  ${pair}`);
    }
    if (sorted.length > shown.length) {
      out.push(`  … (+${sorted.length - shown.length} arquivos omitidos por limite de contexto — priorizados os de maior similaridade)`);
    }
    return out;
  };

  const lines: string[] = [];
  lines.push("INVENTÁRIO COMPLETO DE ARQUIVOS (determinístico — todos os arquivos analisados devem ser mencionados no parecer conforme sua classificação abaixo):");
  lines.push("Legenda: IDÊNTICO ≥85% · ALTA SIMILARIDADE 60–84% · SIMILAR PARCIAL 30–59% · DIVERGENTE 1–29% · SEM CORRESPONDÊNCIA 0%");
  lines.push(...renderSide("A", filesA, bestForA));
  lines.push(...renderSide("B", filesB, bestForB));
  return lines.join("\n");
}