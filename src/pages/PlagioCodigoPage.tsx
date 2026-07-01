import { useState } from "react";
import {
  Loader2, Copy, Check, Code2, Save, X,
  ShieldAlert, ShieldCheck, ShieldQuestion, FileCode2, AlertCircle, KeyRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

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

// ── GitLab icon (SVG inline — lucide não tem) ─────────────────────────────────
function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

// ── Provider detection ────────────────────────────────────────────────────────
type Provider = "github" | "gitlab" | null;

function detectProvider(url: string): Provider {
  const u = url.toLowerCase();
  if (u.includes("github.com")) return "github";
  if (u.includes("gitlab")) return "gitlab";
  return null;
}

function ProviderBadge({ url }: { url: string }) {
  const p = detectProvider(url);
  if (!p) return null;
  if (p === "github") return (
    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/40 flex items-center gap-1">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
      GitHub
    </span>
  );
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 flex items-center gap-1">
      <GitLabIcon className="h-3 w-3" />
      GitLab
    </span>
  );
}

// ── Repo fetchers ─────────────────────────────────────────────────────────────
const CODE_EXTENSIONS = /\.(py|js|ts|tsx|jsx|java|c|cpp|h|cs|go|rs|php|swift|kt|sql|sh|lua|rb|r|scala|dart)$/i;
const IGNORE_PATHS    = /node_modules|dist|\.next|build|__pycache__|\.git|vendor|coverage/;
const MAX_FILES = 30;
const MAX_DEPTH = 3;

async function fetchGitHubRepo(url: string, token?: string): Promise<string> {
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

  const files = (await collect()).slice(0, MAX_FILES);
  if (!files.length) throw new Error("Nenhum arquivo de código encontrado no repositório GitHub.");

  let out = `// ═══ REPOSITÓRIO (GitHub): ${owner}/${repo} — ${files.length} arquivos ═══\n\n`;
  for (const f of files) {
    const txt = await fetch(f.download_url).then(r => r.text()).catch(() => "// [erro ao ler arquivo]");
    out += `// ── ARQUIVO: ${f.path} ──\n${txt.slice(0, 8000)}\n\n`;
  }
  return out;
}

async function fetchGitLabRepo(url: string, token?: string): Promise<string> {
  const clean = url.trim().replace(/\/$/, "").replace(/^https?:\/\//, "");
  // Supports: gitlab.com/owner/repo  OR  gitlab.com/group/sub/repo
  const slashIdx = clean.indexOf("/");
  if (slashIdx === -1) throw new Error("URL GitLab inválida. Use: gitlab.com/usuario/repositorio");

  const host      = clean.slice(0, slashIdx);
  const pathRaw   = clean.slice(slashIdx + 1).replace(/\.git$/, "");
  const baseUrl   = `https://${host}/api/v4/projects/${encodeURIComponent(pathRaw)}`;
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;

  const collect = async (path = "", depth = 0): Promise<string[]> => {
    if (depth > MAX_DEPTH) return [];
    const r = await fetch(
      `${baseUrl}/repository/tree?path=${encodeURIComponent(path)}&per_page=100&ref=HEAD`,
      { headers }
    );
    if (!r.ok) {
      if (r.status === 404) throw new Error("Repositório GitLab não encontrado. Verifique a URL e o token para repos privados.");
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

  const filePaths = (await collect()).slice(0, MAX_FILES);
  if (!filePaths.length) throw new Error("Nenhum arquivo de código encontrado no repositório GitLab.");

  let out = `// ═══ REPOSITÓRIO (GitLab): ${pathRaw} — ${filePaths.length} arquivos ═══\n\n`;
  for (const fp of filePaths) {
    const rawUrl = `${baseUrl}/repository/files/${encodeURIComponent(fp)}/raw?ref=HEAD`;
    const txt = await fetch(rawUrl, { headers }).then(r => r.text()).catch(() => "// [erro ao ler arquivo]");
    out += `// ── ARQUIVO: ${fp} ──\n${txt.slice(0, 8000)}\n\n`;
  }
  return out;
}

async function fetchRepo(url: string, token?: string): Promise<string> {
  const p = detectProvider(url);
  if (p === "github") return fetchGitHubRepo(url, token);
  if (p === "gitlab") return fetchGitLabRepo(url, token);
  throw new Error("URL não reconhecida. Use github.com/... ou gitlab.com/...");
}

// ── Component ─────────────────────────────────────────────────────────────────
const PlagioCodigoPage = () => {
  const [codeA, setCodeA]           = useState("");
  const [codeB, setCodeB]           = useState("");
  const [context, setContext]       = useState("");
  const [result, setResult]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const [accessToken, setAccessToken]   = useState("");
  const [repoUrlA, setRepoUrlA]     = useState("");
  const [repoUrlB, setRepoUrlB]     = useState("");
  const [fetching, setFetching]     = useState<"A" | "B" | null>(null);
  const [filesA, setFilesA]         = useState(0);
  const [filesB, setFilesB]         = useState(0);

  const { verdict, similarity } = parseVerdict(result);

  const doFetch = async (side: "A" | "B") => {
    const url = side === "A" ? repoUrlA : repoUrlB;
    if (!url.trim()) { toast({ title: "Informe a URL do repositório", variant: "destructive" }); return; }
    setFetching(side);
    try {
      const code = await fetchRepo(url, accessToken || undefined);
      const count = (code.match(/\/\/ ── ARQUIVO:/g) || []).length;
      if (side === "A") { setCodeA(code); setFilesA(count); }
      else              { setCodeB(code); setFilesB(count); }
      toast({ title: `Repositório ${side} carregado`, description: `${count} arquivos extraídos.` });
    } catch (e: any) {
      toast({ title: "Erro ao importar repositório", description: e.message, variant: "destructive" });
    } finally {
      setFetching(null);
    }
  };

  const handleAnalyze = async () => {
    if (!codeA || !codeB) {
      toast({ title: "Importe ambos os repositórios antes de analisar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult("");

    const prompt = `[PERÍCIA DE PLÁGIO DE SOFTWARE — ANÁLISE FORENSE]

REPOSITÓRIO A (REFERÊNCIA): ${repoUrlA || "Código A"}
REPOSITÓRIO B (SUSPEITO): ${repoUrlB || "Código B"}
CONTEXTO: ${context || "Não informado"}

INSTRUÇÕES OBRIGATÓRIAS:
1. A primeira linha do parecer DEVE ser: VEREDITO: [CULPADO | SUSPEITO | NÃO CULPADO]
2. A segunda linha DEVE ser: SIMILARIDADE: [0-100]%
3. Em seguida, produza o parecer técnico completo.
4. Compare lógica algorítmica, não apenas texto — detecte plágio cross-language (ex: Python traduzido para JS).
5. Identifique ofuscação deliberada (renomeação de variáveis, inversão de condições, reordenação de blocos).

CÓDIGO A (${filesA} arquivos):
${codeA.slice(0, 18000)}

CÓDIGO B (${filesB} arquivos):
${codeB.slice(0, 18000)}`;

    await streamForensicAnalysis({
      type: "plagio-codigo",
      content: prompt,
      onDelta: (text) => setResult(prev => prev + text),
      onDone:  () => setLoading(false),
      onError: (err) => { setLoading(false); toast({ title: "Erro na análise", description: err, variant: "destructive" }); },
    });
  };

  const repoPreview = (side: "A" | "B", code: string, count: number) => {
    const url = side === "A" ? repoUrlA : repoUrlB;
    if (!code) return (
      <div className="flex flex-col items-center justify-center h-[140px] bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
        {detectProvider(url) === "gitlab"
          ? <GitLabIcon className="h-7 w-7 text-white/10 mb-2" />
          : <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-white/10 mb-2"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
        }
        <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Aguardando Importação</p>
      </div>
    );
    return (
      <div className="relative group">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
            <FileCode2 className="h-3 w-3 mr-1" />{count} arquivos
          </Badge>
          <Button variant="ghost" size="sm"
            onClick={() => { if(side==="A"){setCodeA("");setFilesA(0);}else{setCodeB("");setFilesB(0);} }}
            className="h-6 w-6 p-0 rounded-full bg-black/60 hover:bg-red-500/20 text-white/40 hover:text-red-400">
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="h-[140px] overflow-auto bg-white/[0.03] border border-white/10 rounded-2xl p-3 font-mono text-[10px] text-white/50 leading-relaxed custom-scrollbar">
          {code.slice(0, 2000)}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Análise de Plágio de Código-Fonte</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Perícia forense cross-language entre repositórios GitHub e GitLab — detecta plágio mesmo após tradução ou ofuscação de linguagem.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Painel de entrada ── */}
        <div className="space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Code2 className="h-24 w-24" />
            </div>

            {/* Token de acesso */}
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-white">Token de Acesso</h3>
                <Badge variant="outline" className="ml-auto text-[9px] text-white/30 border-white/10">Opcional para repos públicos</Badge>
              </div>
              <Input type="password"
                placeholder="GitHub: ghp_xxx... · GitLab: glpat-xxx..."
                value={accessToken} onChange={e => setAccessToken(e.target.value)}
                className="bg-black/40 border-white/10 h-9 rounded-xl text-xs" />
              <p className="text-[10px] text-white/20">
                GitHub: Settings → Developer settings → Personal access tokens<br />
                GitLab: User Settings → Access Tokens (scope: <code>read_repository</code>)
              </p>
            </div>

            {/* Repos A e B */}
            {(["A", "B"] as const).map(side => (
              <div key={side} className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 space-y-3 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-glow-sm">{side}</div>
                    <label className="text-xs font-bold text-white/60 uppercase tracking-widest">
                      {side === "A" ? "Código de Referência" : "Código Suspeito"}
                    </label>
                    <ProviderBadge url={side === "A" ? repoUrlA : repoUrlB} />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={`github.com/org/repo ou gitlab.com/org/repo`}
                      value={side === "A" ? repoUrlA : repoUrlB}
                      onChange={e => side === "A" ? setRepoUrlA(e.target.value) : setRepoUrlB(e.target.value)}
                      className="h-8 text-xs bg-black/40 border-white/10 w-52 rounded-xl" />
                    <Button onClick={() => doFetch(side)} disabled={fetching === side}
                      className="h-8 w-8 p-0 bg-primary text-black hover:bg-white transition-all rounded-xl flex-shrink-0">
                      {fetching === side
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : detectProvider(side === "A" ? repoUrlA : repoUrlB) === "gitlab"
                          ? <GitLabIcon className="h-4 w-4" />
                          : <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                      }
                    </Button>
                  </div>
                </div>
                {repoPreview(side, side === "A" ? codeA : codeB, side === "A" ? filesA : filesB)}
              </div>
            ))}

            {/* Context */}
            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Contexto Adicional</label>
              <Textarea placeholder="Descreva particularidades do caso (linguagens envolvidas, datas, suspeitos, etc)..."
                value={context} onChange={e => setContext(e.target.value)}
                className="min-h-[70px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/20 resize-none rounded-2xl text-sm" />
            </div>

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            {/* Limits info */}
            <div className="flex items-start gap-2 text-[11px] text-white/30 bg-white/[0.02] rounded-xl p-3">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Análise profunda: até {MAX_FILES} arquivos por repositório, profundidade {MAX_DEPTH} níveis.
                Detecta plágio cross-language (Python→JS, Java→C#, etc.).
                Suporta <strong className="text-white/40">GitHub</strong> e <strong className="text-orange-400/60">GitLab</strong> (cloud e self-hosted).
              </span>
            </div>

            <Button onClick={handleAnalyze} disabled={loading || !codeA || !codeB}
              className="w-full bg-primary text-black font-bold h-12 rounded-2xl hover:bg-white transition-all shadow-glow-md">
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Analisando semelhanças algorítmicas...</>
                : <><Code2 className="h-5 w-5 mr-2" />Iniciar Análise Forense de Plágio</>}
            </Button>
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
                  await saveEvidence({
                    module: "plagio-codigo",
                    title: `Perícia de Software: ${(repoUrlB || "Repo B").split("/").pop()}`,
                    inputContent: `Origem A: ${repoUrlA}\nOrigem B: ${repoUrlB}\nVeredito: ${verdict || "—"}\nSimilaridade: ${similarity ?? "—"}%`,
                    resultContent: result,
                    caseId: selectedCase !== "none" ? selectedCase : undefined,
                    metadata: { repoUrlA, repoUrlB, context, verdict, similarity },
                  });
                  setSaving(false);
                  toast({ title: "Laudo salvo na cadeia de custódia!" });
                }} disabled={saving} className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-8 rounded-xl border border-white/5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-primary" />}
                  Salvar Laudo
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

          {/* Verdict + Similarity */}
          {(verdict || similarity !== null) && (
            <div className="space-y-3 mb-5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <VerdictBadge verdict={verdict} />
              <SimilarityMeter value={similarity} />
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
