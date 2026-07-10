import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import {
  Loader2, Copy, Check, Code2, Save, X,
  ShieldAlert, ShieldCheck, ShieldQuestion, FileCode2, AlertCircle,
  KeyRound, Upload, Link2, FolderOpen, Fingerprint, GitCompare, Lock,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import CaseSelector from "@/components/dashboard/CaseSelector";
import {
  formatEvidenceForLLM,
  type StructuralReport,
} from "@/lib/structural-plagiarism";
import PlagiarismWorker from "@/workers/plagiarism-worker.ts?worker";
import type { WorkerResponse } from "@/workers/plagiarism-worker";

// ── Verdict helpers ───────────────────────────────────────────────────────────
type Verdict = "CULPADO" | "SUSPEITO" | "NÃO CULPADO" | null;

function parseVerdict(text: string): { verdict: Verdict; similarity: number | null } {
  const vm = text.match(/VEREDITO\s*:\s*(CULPADO|SUSPEITO|NÃO CULPADO|NAO CULPADO)/i);
  const sm = text.match(/SIMILARIDADE\s*:\s*(\d+)\s*%/i);
  let verdict: Verdict = null;
  if (vm) {
    const v = vm[1].toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    verdict = v === "NAO CULPADO" ? "NÃO CULPADO" : (v as Verdict);
  }
  return { verdict, similarity: sm ? parseInt(sm[1]) : null };
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;
  const cfg = {
    "CULPADO":     { icon: ShieldAlert,    cls: "bg-red-500/20 border-red-500/50 text-red-300",       label: "CULPADO" },
    "SUSPEITO":    { icon: ShieldQuestion, cls: "bg-amber-500/20 border-amber-500/50 text-amber-300",  label: "SUSPEITO" },
    "NÃO CULPADO": { icon: ShieldCheck,    cls: "bg-green-500/20 border-green-500/50 text-green-300",  label: "NÃO CULPADO" },
  }[verdict];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cfg.cls} font-bold text-sm`}>
      <Icon className="h-4 w-4" />
      VEREDITO: {cfg.label}
    </div>
  );
}

function SimilarityMeter({ value }: { value: number | null }) {
  if (value === null) return null;
  const color = value >= 70 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>Similaridade detectada</span>
        <span className="font-bold text-white">{value}%</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Icons (inline SVG para GitHub/GitLab) ────────────────────────────────────
const GithubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
  </svg>
);

const GitLabIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
  </svg>
);

// ── Tech stack detection ──────────────────────────────────────────────────────
const LANG_MAP: Record<string, { label: string; color: string }> = {
  py:    { label: "Python",      color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  js:    { label: "JavaScript",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  ts:    { label: "TypeScript",  color: "bg-blue-400/20 text-blue-200 border-blue-400/30" },
  tsx:   { label: "TSX",         color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  jsx:   { label: "JSX",         color: "bg-yellow-400/20 text-yellow-200 border-yellow-400/30" },
  java:  { label: "Java",        color: "bg-red-500/20 text-red-300 border-red-500/30" },
  cs:    { label: "C#",          color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  go:    { label: "Go",          color: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  rs:    { label: "Rust",        color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  cpp:   { label: "C++",         color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  c:     { label: "C",           color: "bg-gray-400/20 text-gray-300 border-gray-400/30" },
  php:   { label: "PHP",         color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  swift: { label: "Swift",       color: "bg-orange-400/20 text-orange-200 border-orange-400/30" },
  kt:    { label: "Kotlin",      color: "bg-purple-400/20 text-purple-200 border-purple-400/30" },
  rb:    { label: "Ruby",        color: "bg-red-400/20 text-red-200 border-red-400/30" },
  sh:    { label: "Shell",       color: "bg-green-500/20 text-green-300 border-green-500/30" },
  sql:   { label: "SQL",         color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  dart:  { label: "Dart",        color: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30" },
  scala: { label: "Scala",       color: "bg-red-300/20 text-red-200 border-red-300/30" },
  r:     { label: "R",           color: "bg-blue-300/20 text-blue-100 border-blue-300/30" },
  lua:   { label: "Lua",         color: "bg-indigo-400/20 text-indigo-200 border-indigo-400/30" },
};

function detectTechStack(code: string): string[] {
  const exts = new Set<string>();
  const matches = code.matchAll(/\/\/ ── ARQUIVO: .+\.(\w+) ──/g);
  for (const m of matches) exts.add(m[1].toLowerCase());
  return [...exts].filter(e => LANG_MAP[e]);
}

function TechBadges({ code }: { code: string }) {
  const langs = detectTechStack(code);
  if (!langs.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {langs.map(ext => {
        const info = LANG_MAP[ext];
        return (
          <span key={ext} className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${info.color}`}>
            {info.label}
          </span>
        );
      })}
    </div>
  );
}

type BundleFile = { path: string; body: string };

function parseCodeBundle(bundle: string): BundleFile[] {
  const parts = bundle.split(/\/\/ ── ARQUIVO: (.+?) ──\n/);
  const files: BundleFile[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    files.push({ path: parts[i].trim(), body: parts[i + 1] ?? "" });
  }
  return files;
}

function relevantPathsFromReport(report: StructuralReport | null): Set<string> {
  const paths = new Set<string>();
  if (!report) return paths;
  for (const pair of report.filePairs) {
    paths.add(pair.a);
    paths.add(pair.b);
  }
  for (const match of report.matches) {
    paths.add(match.fileA);
    paths.add(match.fileB);
  }
  return paths;
}

function buildBalancedRepoExcerpt(bundle: string, relevantPaths: Set<string>, maxChars = MAX_PROMPT_REPO_CHARS): string {
  const files = parseCodeBundle(bundle);
  if (!files.length) return bundle.slice(0, maxChars);

  const ordered = [
    ...files.filter((file) => relevantPaths.has(file.path)),
    ...files.filter((file) => !relevantPaths.has(file.path)),
  ];

  const headerBudget = 120;
  const perFileBudget = Math.max(1200, Math.min(MAX_PROMPT_FILE_CHARS, Math.floor(maxChars / Math.max(1, ordered.length)) - headerBudget));
  let output = "";
  let included = 0;

  for (const file of ordered) {
    const remaining = maxChars - output.length;
    if (remaining <= 500) break;
    const body = file.body.slice(0, Math.min(perFileBudget, remaining));
    output += `// ── ARQUIVO: ${file.path} ──\n${body}`;
    if (file.body.length > body.length) output += `\n// [trecho limitado: ${file.body.length - body.length} caracteres adicionais omitidos]`;
    output += "\n\n";
    included++;
  }

  if (included < files.length) {
    output += `// [${files.length - included} arquivo(s) não incluído(s) no prompt por limite de contexto; priorizados arquivos com maior similaridade estrutural.]`;
  }
  return output.trim();
}

// ── Provider detection ────────────────────────────────────────────────────────
type Provider = "github" | "gitlab" | null;
function detectProvider(url: string): Provider {
  const u = url.toLowerCase();
  if (u.includes("github.com")) return "github";
  if (u.includes("gitlab")) return "gitlab";
  return null;
}

// ── Repo fetchers ─────────────────────────────────────────────────────────────
const CODE_EXTENSIONS = /\.(py|js|mjs|cjs|ts|tsx|jsx|java|c|cpp|cc|hh|hpp|h|cs|go|rs|php|swift|kt|kts|sql|sh|bash|zsh|lua|rb|r|scala|dart|vue|svelte|md|mdx|txt|yaml|yml|json|toml|ini|xml|html|css|scss)$/i;
const IGNORE_PATHS    = /node_modules|dist|\.next|build|__pycache__|\.git|vendor|coverage/;
const MAX_FILES = Number.POSITIVE_INFINITY;
const MAX_DEPTH = 8;
const MAX_FILE_CHARS = 8000;
const MAX_PROMPT_REPO_CHARS = 52000;
const MAX_PROMPT_FILE_CHARS = 12000;

async function fetchGitHubRepo(url: string, token?: string, strict = false): Promise<string> {
  const match = url.trim().replace(/\/$/, "").match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) throw new Error("URL GitHub inválida. Use: github.com/usuario/repositorio");
  const [, owner, repoRaw] = match;
  const repo = repoRaw.replace(/\.git$/, "");
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `token ${token}`;

  const collect = async (path = "", depth = 0): Promise<{ path: string; download_url: string }[]> => {
    if (depth > MAX_DEPTH) return [];
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!r.ok) return [];
    const items: any[] = await r.json();
    let files: { path: string; download_url: string }[] = [];
    for (const item of items) {
      if (files.length >= MAX_FILES) break;
      if (item.type === "file" && CODE_EXTENSIONS.test(item.name) && !IGNORE_PATHS.test(item.path))
        files.push({ path: item.path, download_url: item.download_url });
      else if (item.type === "dir" && !IGNORE_PATHS.test(item.path) && depth < MAX_DEPTH)
        files = [...files, ...(await collect(item.path, depth + 1))];
    }
    return files;
  };

  const collected = await collect();
  if (strict && collected.length > MAX_FILES) {
    throw new Error(`Modo estrito: repositório GitHub tem ${collected.length} arquivos de código, excede o limite de ${MAX_FILES}. Reduza o escopo ou desligue o modo estrito.`);
  }
  const files = collected.slice(0, MAX_FILES);
  if (!files.length) throw new Error("Nenhum arquivo compatível encontrado no repositório GitHub (extensões aceitas: código-fonte, markdown, yaml, json, txt e afins). Verifique se a URL aponta para o repositório correto e se ele não está vazio.");
  let out = `// ═══ REPOSITÓRIO (GitHub): ${owner}/${repo} — ${files.length} arquivos ═══\n\n`;
  for (const f of files) {
    const txt = await fetch(f.download_url).then(r => r.text()).catch(() => "// [erro ao ler arquivo]");
    if (strict && txt.length > MAX_FILE_CHARS) {
      throw new Error(`Modo estrito: arquivo "${f.path}" tem ${txt.length} chars, excede ${MAX_FILE_CHARS}. Desligue o modo estrito para permitir truncamento.`);
    }
    out += `// ── ARQUIVO: ${f.path} ──\n${txt.slice(0, MAX_FILE_CHARS)}\n\n`;
  }
  return out;
}

async function fetchGitLabRepo(url: string, token?: string, strict = false): Promise<string> {
  const clean = url.trim().replace(/\/$/, "").replace(/^https?:\/\//, "");
  const slashIdx = clean.indexOf("/");
  if (slashIdx === -1) throw new Error("URL GitLab inválida. Use: gitlab.com/usuario/repositorio");
  const host    = clean.slice(0, slashIdx);
  const pathRaw = clean.slice(slashIdx + 1).replace(/\.git$/, "");
  const baseUrl = `https://${host}/api/v4/projects/${encodeURIComponent(pathRaw)}`;
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;

  const collect = async (path = "", depth = 0): Promise<string[]> => {
    if (depth > MAX_DEPTH) return [];
    const r = await fetch(`${baseUrl}/repository/tree?path=${encodeURIComponent(path)}&per_page=100&ref=HEAD`, { headers });
    if (!r.ok) {
      if (r.status === 404) throw new Error("Repositório GitLab não encontrado. Verifique a URL e o token.");
      return [];
    }
    const items: any[] = await r.json();
    let files: string[] = [];
    for (const item of items) {
      if (files.length >= MAX_FILES) break;
      if (item.type === "blob" && CODE_EXTENSIONS.test(item.name) && !IGNORE_PATHS.test(item.path))
        files.push(item.path);
      else if (item.type === "tree" && !IGNORE_PATHS.test(item.path) && depth < MAX_DEPTH)
        files = [...files, ...(await collect(item.path, depth + 1))];
    }
    return files;
  };

  const collected = await collect();
  if (strict && collected.length > MAX_FILES) {
    throw new Error(`Modo estrito: repositório GitLab tem ${collected.length} arquivos de código, excede o limite de ${MAX_FILES}.`);
  }
  const filePaths = collected.slice(0, MAX_FILES);
  if (!filePaths.length) throw new Error("Nenhum arquivo de código encontrado no repositório GitLab.");
  let out = `// ═══ REPOSITÓRIO (GitLab): ${pathRaw} — ${filePaths.length} arquivos ═══\n\n`;
  for (const fp of filePaths) {
    const txt = await fetch(`${baseUrl}/repository/files/${encodeURIComponent(fp)}/raw?ref=HEAD`, { headers })
      .then(r => r.text()).catch(() => "// [erro ao ler arquivo]");
    if (strict && txt.length > MAX_FILE_CHARS) {
      throw new Error(`Modo estrito: arquivo "${fp}" tem ${txt.length} chars, excede ${MAX_FILE_CHARS}.`);
    }
    out += `// ── ARQUIVO: ${fp} ──\n${txt.slice(0, MAX_FILE_CHARS)}\n\n`;
  }
  return out;
}

async function fetchRepo(url: string, token?: string, strict = false): Promise<string> {
  const p = detectProvider(url);
  if (p === "github") return fetchGitHubRepo(url, token, strict);
  if (p === "gitlab") return fetchGitLabRepo(url, token, strict);
  throw new Error("URL não reconhecida. Use github.com/... ou gitlab.com/...");
}

// ── File / ZIP reader ─────────────────────────────────────────────────────────
async function readFilesAsCode(fileList: FileList | File[], strict = false): Promise<{ code: string; count: number }> {
  const files = Array.from(fileList);
  let combined = "";
  let count = 0;
  const label = files.length === 1 && files[0].name ? files[0].name : `${files.length} arquivo(s)`;

  for (const file of files) {
    // ZIP: extrair com JSZip
    if (file.name.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      const allEntries = Object.entries(zip.files)
        .filter(([name, entry]) => !entry.dir && CODE_EXTENSIONS.test(name) && !IGNORE_PATHS.test(name));
      if (strict && allEntries.length > MAX_FILES) {
        throw new Error(`Modo estrito: ZIP contém ${allEntries.length} arquivos de código, excede ${MAX_FILES}.`);
      }
      const entries = allEntries.slice(0, MAX_FILES);

      if (!combined) combined = `// ═══ UPLOAD: ${label} — ${entries.length} arquivos ═══\n\n`;
      for (const [name, entry] of entries) {
        const txt = await entry.async("string").catch(() => "// [erro ao ler arquivo]");
        if (strict && txt.length > MAX_FILE_CHARS) {
          throw new Error(`Modo estrito: "${name}" tem ${txt.length} chars, excede ${MAX_FILE_CHARS}.`);
        }
        combined += `// ── ARQUIVO: ${name} ──\n${txt.slice(0, MAX_FILE_CHARS)}\n\n`;
        count++;
      }
    } else if (CODE_EXTENSIONS.test(file.name) && !IGNORE_PATHS.test(file.name)) {
      // Arquivo de código individual
      const txt = await file.text().catch(() => "// [erro ao ler arquivo]");
      if (strict && txt.length > MAX_FILE_CHARS) {
        throw new Error(`Modo estrito: "${file.name}" tem ${txt.length} chars, excede ${MAX_FILE_CHARS}.`);
      }
      if (!combined) combined = `// ═══ UPLOAD: ${label} — arquivos ═══\n\n`;
      combined += `// ── ARQUIVO: ${file.name} ──\n${txt.slice(0, MAX_FILE_CHARS)}\n\n`;
      count++;
    }

    if (count >= MAX_FILES) {
      if (strict && files.indexOf(file) < files.length - 1) {
        throw new Error(`Modo estrito: seleção excede ${MAX_FILES} arquivos.`);
      }
      break;
    }
  }

  if (!count) throw new Error("Nenhum arquivo de código reconhecido. Envie .py, .js, .ts, .java, etc. ou um .zip.");

  // Atualizar header com contagem real
  combined = combined.replace(/— arquivos ═══/, `— ${count} arquivo(s) ═══`);
  return { code: combined, count };
}

// ── Drop Zone component ───────────────────────────────────────────────────────
function DropZone({ onFiles, loading }: { onFiles: (fl: FileList) => void; loading: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center h-[140px] border-2 border-dashed rounded-2xl cursor-pointer transition-all
        ${dragging ? "border-primary bg-primary/10" : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"}`}
    >
      <input ref={inputRef} type="file" multiple className="hidden"
        accept=".py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.h,.cs,.go,.rs,.php,.swift,.kt,.sql,.sh,.lua,.rb,.r,.scala,.dart,.zip"
        onChange={e => e.target.files && onFiles(e.target.files)} />
      {loading
        ? <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        : <Upload className="h-6 w-6 text-white/20 mb-2" />
      }
      <p className="text-xs text-white/30 text-center px-4">
        {loading ? "Lendo arquivos..." : <>Arraste arquivos de código ou <span className="text-primary underline">clique para selecionar</span></>}
      </p>
      <p className="text-[10px] text-white/15 mt-1">.py .js .ts .java .go .cs ... ou .zip</p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
type ImportMode = "url" | "upload";

const PlagioCodigoPage = () => {
  const [codeA, setCodeA]         = useState("");
  const [codeB, setCodeB]         = useState("");
  const [context, setContext]     = useState("");
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const [tokenA, setTokenA]       = useState("");
  const [tokenB, setTokenB]       = useState("");
  const [repoUrlA, setRepoUrlA]   = useState("");
  const [repoUrlB, setRepoUrlB]   = useState("");
  const [fetching, setFetching]   = useState<"A" | "B" | null>(null);
  const [filesA, setFilesA]       = useState(0);
  const [filesB, setFilesB]       = useState(0);
  const [modeA, setModeA]         = useState<ImportMode>("url");
  const [modeB, setModeB]         = useState<ImportMode>("url");
  const [structural, setStructural] = useState<StructuralReport | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [savedEvidenceId, setSavedEvidenceId] = useState<string | null>(null);
  const [generatingLaudo, setGeneratingLaudo] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const { verdict, similarity } = parseVerdict(result);

  const doFetch = async (side: "A" | "B") => {
    const url = side === "A" ? repoUrlA : repoUrlB;
    const token = side === "A" ? tokenA : tokenB;
    if (!url.trim()) { toast({ title: "Informe a URL do repositório", variant: "destructive" }); return; }
    setFetching(side);
    try {
      const code = await fetchRepo(url, token || undefined, strictMode);
      const count = (code.match(/\/\/ ── ARQUIVO:/g) || []).length;
      if (side === "A") { setCodeA(code); setFilesA(count); }
      else              { setCodeB(code); setFilesB(count); }
      toast({ title: `Repositório ${side} carregado`, description: `${count} arquivos extraídos.` });
    } catch (e: any) {
      toast({ title: "Erro ao importar repositório", description: e.message, variant: "destructive" });
    } finally { setFetching(null); }
  };

  const doUpload = async (side: "A" | "B", fl: FileList) => {
    setFetching(side);
    try {
      const { code, count } = await readFilesAsCode(fl, strictMode);
      if (side === "A") { setCodeA(code); setFilesA(count); }
      else              { setCodeB(code); setFilesB(count); }
      toast({ title: `Arquivos ${side} carregados`, description: `${count} arquivo(s) lido(s).` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally { setFetching(null); }
  };

  const clearSide = (side: "A" | "B") => {
    if (side === "A") { setCodeA(""); setFilesA(0); }
    else              { setCodeB(""); setFilesB(0); }
  };

  const handleAnalyze = async () => {
    if (!codeA || !codeB) {
      toast({ title: "Importe ambos os repositórios antes de analisar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult("");
    setStructural(null);
    setEvidenceHash(null);
    setSavedEvidenceId(null);
    setProgress({ done: 0, total: 0 });

    const techA = detectTechStack(codeA).map(e => LANG_MAP[e]?.label || e).join(", ") || "não identificada";
    const techB = detectTechStack(codeB).map(e => LANG_MAP[e]?.label || e).join(", ") || "não identificada";

    // ─── Camada 1: análise estrutural determinística (estilo JPlag) ───
    // Roda em Web Worker (thread separada) — usa CPU completa sem travar UI.
    // Alimenta o prompt como evidência objetiva citável conforme Manifesto.
    let report: StructuralReport | null = null;
    let hash: string | null = null;
    try {
      const workerResult = await new Promise<{ report: StructuralReport; hash: string }>((resolve, reject) => {
        workerRef.current?.terminate();
        const worker = new PlagiarismWorker();
        workerRef.current = worker;
        worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
          const msg = ev.data;
          if (msg.type === "progress") {
            setProgress({ done: msg.done, total: msg.total });
          } else if (msg.type === "done") {
            worker.terminate();
            workerRef.current = null;
            resolve({ report: msg.report, hash: msg.hash });
          } else if (msg.type === "error") {
            worker.terminate();
            workerRef.current = null;
            reject(new Error(msg.message));
          }
        };
        worker.onerror = (err) => {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(err.message || "Worker error"));
        };
        worker.postMessage({ type: "analyze", bundleA: codeA, bundleB: codeB });
      });
      report = workerResult.report;
      hash = workerResult.hash;
      setStructural(report);
      setEvidenceHash(hash);
    } catch (e) {
      console.warn("Falha na análise estrutural:", e);
    } finally {
      setProgress(null);
    }
    const evidenceBlock = report
      ? `${formatEvidenceForLLM(report)}\n- Hash SHA-256 da evidência (reprodutibilidade): ${hash ?? "n/d"}`
      : "";

    const prompt = `[PERÍCIA DE PLÁGIO DE SOFTWARE — ANÁLISE FORENSE JUDICIAL]

REPOSITÓRIO A (REFERÊNCIA): ${repoUrlA || "Upload local A"}
REPOSITÓRIO B (SUSPEITO):   ${repoUrlB || "Upload local B"}
TECNOLOGIAS DETECTADAS A: ${techA}
TECNOLOGIAS DETECTADAS B: ${techB}
CONTEXTO: ${context || "Não informado"}

INSTRUÇÕES OBRIGATÓRIAS:
1. PRIMEIRA LINHA obrigatória: VEREDITO: [CULPADO | SUSPEITO | NÃO CULPADO]
2. SEGUNDA LINHA obrigatória: SIMILARIDADE: [0-100]%
3. Produza o parecer técnico completo nas seções abaixo.
4. Compare LÓGICA ALGORÍTMICA — detecte plágio cross-language (ex: Python traduzido para JS, Java reescrito em C#).
5. Identifique ofuscação deliberada (renomeação de variáveis, inversão de condições, reordenação de blocos).
6. Analise TECNOLOGIAS em uso: frameworks, bibliotecas, padrões arquiteturais — compare entre A e B.
7. Use a EVIDÊNCIA ESTRUTURAL abaixo como base objetiva do parecer — cite os pares de arquivos e linhas
   identificados; a similaridade estrutural determinística tem precedência sobre a impressão textual.
   A tokenização já ignora nomes de variáveis, então blocos idênticos ali comprovam correspondência
   estrutural independentemente de renomeação.

${evidenceBlock}

CÓDIGO A (${filesA} arquivos — tecnologias: ${techA}):
${codeA.slice(0, 18000)}

CÓDIGO B (${filesB} arquivos — tecnologias: ${techB}):
${codeB.slice(0, 18000)}`;

    await streamForensicAnalysis({
      type: "plagio-codigo",
      content: prompt,
      onDelta: (text) => setResult(prev => prev + text),
      onDone:  () => setLoading(false),
      onError: (err) => { setLoading(false); toast({ title: "Erro na análise", description: err, variant: "destructive" }); },
    });
  };

  const renderPanel = (side: "A" | "B") => {
    const isA    = side === "A";
    const code   = isA ? codeA : codeB;
    const count  = isA ? filesA : filesB;
    const url    = isA ? repoUrlA : repoUrlB;
    const mode   = isA ? modeA : modeB;
    const setUrl = isA ? setRepoUrlA : setRepoUrlB;
    const setMode = isA ? setModeA : setModeB;
    const prov   = detectProvider(url);

    return (
      <div className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 space-y-3 hover:border-white/20 transition-all">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{side}</div>
          <label className="text-xs font-bold text-white/60 uppercase tracking-widest flex-1">
            {isA ? "Código de Referência" : "Código Suspeito"}
          </label>
          {/* Mode toggle */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all
                ${mode === "url" ? "bg-primary text-black" : "text-white/30 hover:text-white/60"}`}>
              <Link2 className="h-3 w-3" /> URL
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-all
                ${mode === "upload" ? "bg-primary text-black" : "text-white/30 hover:text-white/60"}`}>
              <Upload className="h-3 w-3" /> Upload
            </button>
          </div>
        </div>

        {/* URL mode */}
        {mode === "url" && !code && (
          <div className="flex gap-2">
            <Input
              placeholder="github.com/org/repo  ou  gitlab.com/org/repo"
              value={url} onChange={e => setUrl(e.target.value)}
              className="h-8 text-xs bg-black/40 border-white/10 rounded-xl flex-1" />
            <Button onClick={() => doFetch(side)} disabled={fetching === side}
              className="h-8 w-8 p-0 bg-primary text-black hover:bg-white transition-all rounded-xl flex-shrink-0">
              {fetching === side
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : prov === "gitlab" ? <GitLabIcon className="h-4 w-4" /> : <GithubIcon className="h-4 w-4" />
              }
            </Button>
          </div>
        )}

        {/* Upload mode */}
        {mode === "upload" && !code && (
          <DropZone onFiles={fl => doUpload(side, fl)} loading={fetching === side} />
        )}

        {/* Preview (shared) */}
        {code && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                <FileCode2 className="h-3 w-3 mr-1" />{count} arquivos
              </Badge>
              {url && prov === "github" && <Badge variant="outline" className="text-[10px] text-white/30 border-white/10 gap-1"><GithubIcon className="h-3 w-3" />GitHub</Badge>}
              {url && prov === "gitlab" && <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/20 bg-orange-500/10 gap-1"><GitLabIcon className="h-3 w-3" />GitLab</Badge>}
              {!url && <Badge variant="outline" className="text-[10px] text-white/30 border-white/10 gap-1"><FolderOpen className="h-3 w-3" />Upload local</Badge>}
              <Button variant="ghost" size="sm" onClick={() => clearSide(side)}
                className="ml-auto h-6 w-6 p-0 rounded-full bg-black/60 hover:bg-red-500/20 text-white/40 hover:text-red-400">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <TechBadges code={code} />
            <div className="h-[120px] overflow-auto bg-white/[0.03] border border-white/10 rounded-2xl p-3 font-mono text-[10px] text-white/50 leading-relaxed custom-scrollbar">
              {code.slice(0, 2000)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Análise de Plágio de Código-Fonte</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Perícia forense cross-language — GitHub, GitLab ou upload de arquivos. Detecta plágio mesmo após tradução ou ofuscação de linguagem.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Painel de entrada ── */}
        <div className="space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Code2 className="h-24 w-24" />
            </div>

            {/* Tokens A e B — independentes (permite comparar repos de contas/hosts diferentes) */}
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-white">Tokens de Acesso</h3>
                <Badge variant="outline" className="ml-auto text-[9px] text-white/30 border-white/10">Opcional — repos públicos não precisam</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">A</span>
                    Token do Código A
                  </label>
                  <Input type="password"
                    placeholder="ghp_xxx  ou  glpat-xxx"
                    value={tokenA} onChange={e => setTokenA(e.target.value)}
                    className="bg-black/40 border-white/10 h-9 rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">B</span>
                    Token do Código B
                  </label>
                  <Input type="password"
                    placeholder="ghp_xxx  ou  glpat-xxx"
                    value={tokenB} onChange={e => setTokenB(e.target.value)}
                    className="bg-black/40 border-white/10 h-9 rounded-xl text-xs" />
                </div>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Cada lado usa seu próprio token — permite comparar, por exemplo, um repo GitHub privado (A) com um GitLab self-hosted (B), ou duas contas diferentes.
              </p>
            </div>

            {/* Painéis A e B */}
            {renderPanel("A")}
            {renderPanel("B")}

            {/* Contexto */}
            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Contexto Adicional</label>
              <Textarea
                placeholder="Descreva particularidades do caso (linguagens envolvidas, datas, suspeitos, etc)..."
                value={context} onChange={e => setContext(e.target.value)}
                className="min-h-[70px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/20 resize-none rounded-2xl text-sm" />
            </div>

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <div className="flex items-start gap-2 text-[11px] text-white/30 bg-white/[0.02] rounded-xl p-3">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Análise profunda: <strong className="text-white/40">sem limite de quantidade de arquivos</strong> por fonte (profundidade até {MAX_DEPTH} níveis).
                Suporta <strong className="text-white/40">GitHub</strong>, <strong className="text-orange-400/60">GitLab</strong> (cloud e self-hosted) e <strong className="text-white/40">upload local</strong> (.zip ou arquivos individuais).
                Metodologia científica: tokenização estrutural estilo <strong className="text-white/60">JPlag</strong> (Greedy String Tiling) + parecer forense por LLM. Detecta plágio cross-language (Python→JS, Java→C#, etc.).
              </span>
            </div>

            {/* Manifesto — pipeline determinístico + LLM */}
            <div className="flex items-start gap-3 text-[11px] text-white/40 bg-primary/[0.04] border border-primary/15 rounded-2xl p-4">
              <Fingerprint className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-bold text-primary uppercase tracking-widest text-[10px]">
                  Pipeline determinístico + LLM
                </p>
                <p className="leading-relaxed">
                  Tokenização estrutural (estilo <strong className="text-white/60">JPlag</strong>, Greedy String Tiling) roda no
                  navegador antes da IA. Renomear variáveis ou traduzir strings não derruba a similaridade —
                  o comparador lê a <em>forma</em> do código, não os nomes. O resultado alimenta o parecer da LLM
                  como evidência determinística citável linha a linha.
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={e => setStrictMode(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <Lock className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                    Modo estrito (falhar em vez de truncar)
                  </span>
                </label>
              </div>
            </div>

            <Button onClick={handleAnalyze} disabled={loading || !codeA || !codeB}
              className="w-full bg-primary text-black font-bold h-12 rounded-2xl hover:bg-white transition-all shadow-glow-md">
              {loading
                ? <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {progress && progress.total > 0
                      ? `Analisando estrutura ${Math.round((progress.done / progress.total) * 100)}% (${progress.done}/${progress.total} pares)`
                      : "Preparando análise..."}
                  </>
                : <><Code2 className="h-5 w-5 mr-2" />Iniciar Análise Forense de Plágio</>}
            </Button>
            {loading && progress && progress.total > 0 && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary transition-all duration-200 shadow-glow-sm"
                  style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Painel de resultado ── */}
        <div className="glass-card rounded-[2.5rem] p-8 relative border-white/5 bg-white/[0.02] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-widest">Parecer Técnico Forense</h3>
            <div className="flex gap-2">
              {result && !loading && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  setSaving(true);
                  const id = await saveEvidence({
                    module: "plagio-codigo",
                    title: `Perícia de Software: ${(repoUrlB || "Upload B").split("/").pop()}`,
                    inputContent: `Origem A: ${repoUrlA || "Upload"}\nOrigem B: ${repoUrlB || "Upload"}\nVeredito: ${verdict || "—"}\nSimilaridade: ${similarity ?? "—"}%`,
                    resultContent: result,
                    caseId: selectedCase !== "none" ? selectedCase : undefined,
                    metadata: {
                      repoUrlA, repoUrlB, context, verdict, similarity,
                      structuralSimilarity: structural?.similarity ?? null,
                      structuralMatches: structural?.matches.slice(0, 10) ?? [],
                      structuralFilePairs: structural?.filePairs ?? [],
                      minMatchUsed: structural?.minMatchUsed ?? null,
                      languageProfile: structural?.languageProfile ?? null,
                      evidenceHash,
                      strictMode,
                    },
                  });
                  if (id) setSavedEvidenceId(id);
                  setSaving(false);
                  toast({ title: "Evidência salva na cadeia de custódia!", description: "Agora você pode gerar o laudo pericial em DOCX." });
                }} disabled={saving} className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-8 rounded-xl border border-white/5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-primary" />}
                  {savedEvidenceId ? "Salvo" : "Salvar Evidência"}
                </Button>
              )}
              {savedEvidenceId && !loading && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  setGeneratingLaudo(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("export-laudo-docx", { body: { evidenceId: savedEvidenceId } });
                    if (error) throw new Error(error.message);
                    const blob = new Blob([data], { type: "application/msword" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `laudo-plagio-${savedEvidenceId.slice(0, 8)}.doc`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Laudo pericial gerado", description: "Documento DOCX pronto — abra no Word ou LibreOffice." });
                  } catch (err: any) {
                    toast({ title: "Erro ao gerar laudo", description: err.message, variant: "destructive" });
                  } finally { setGeneratingLaudo(false); }
                }} disabled={generatingLaudo} className="text-white hover:text-white hover:bg-primary/20 gap-2 h-8 rounded-xl border border-primary/40 bg-primary/10">
                  {generatingLaudo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                  Gerar Laudo (DOCX)
                </Button>
              )}
              {result && (
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-8 rounded-xl border border-white/5">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </Button>
              )}
            </div>
          </div>

          {/* Veredito + similaridade */}
          {(verdict || similarity !== null) && (
            <div className="space-y-3 mb-5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <VerdictBadge verdict={verdict} />
              <SimilarityMeter value={similarity} />
            </div>
          )}

          {/* Evidência estrutural determinística (JPlag-style) */}
          {structural && (
            <div className="mb-5 p-4 rounded-2xl bg-primary/[0.04] border border-primary/20 space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary">
                  Evidência estrutural determinística
                </h4>
                <Badge variant="outline" className="ml-auto text-[9px] text-white/40 border-white/10 font-mono">
                  JPlag-style · GST
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-xl bg-black/30">
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">Similaridade</p>
                  <p className="text-2xl font-bold text-primary">{structural.similarity}%</p>
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">Tokens A/B</p>
                  <p className="text-sm font-mono text-white/70 mt-1">
                    {structural.totalTokensA}/{structural.totalTokensB}
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  <p className="text-[9px] text-white/40 uppercase tracking-widest">Blocos idênticos</p>
                  <p className="text-sm font-mono text-white/70 mt-1">{structural.matches.length}</p>
                </div>
              </div>
              {structural.filePairs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
                    <GitCompare className="h-3 w-3" /> Pares mais similares
                  </p>
                  <div className="space-y-1 max-h-[120px] overflow-auto custom-scrollbar">
                    {structural.filePairs.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-white/50 truncate flex-1">{p.a}</span>
                        <span className="text-white/20">↔</span>
                        <span className="text-white/50 truncate flex-1">{p.b}</span>
                        <span className={`font-bold ${p.similarity >= 70 ? "text-red-400" : p.similarity >= 40 ? "text-amber-400" : "text-green-400"}`}>
                          {p.similarity}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-white/30 leading-relaxed border-t border-white/5 pt-2">
                Tokenização normaliza identificadores e literais — renomear variáveis <strong className="text-white/50">não</strong> afeta este número.
                Reproduzível: mesmo input, mesmo resultado.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <div className="text-[10px]">
                  <p className="text-white/30 uppercase tracking-widest">Perfil / minMatch</p>
                  <p className="text-white/60 font-mono">
                    {structural.languageProfile} · {structural.minMatchUsed} tokens
                  </p>
                </div>
                <div className="text-[10px]">
                  <p className="text-white/30 uppercase tracking-widest flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> SHA-256 evidência
                  </p>
                  <p className="text-white/60 font-mono truncate" title={evidenceHash ?? ""}>
                    {evidenceHash ? evidenceHash.slice(0, 24) + "…" : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-[400px] max-h-[700px] overflow-auto text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap custom-scrollbar">
            {result ? (
              result.replace(/^VEREDITO:.*\n?/im, "").replace(/^SIMILARIDADE:.*\n?/im, "").trim()
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 py-20">
                <Code2 className="h-12 w-12 mb-4" />
                <p className="text-sm italic text-center max-w-xs">
                  O parecer técnico forense será gerado aqui após a análise comparativa dos repositórios.
                </p>
              </div>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlagioCodigoPage;
