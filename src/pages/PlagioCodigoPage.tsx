import { useState, useRef } from "react";
 import { Loader2, FileText, Copy, Check, Code2, Save, Upload, X, File, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const SUPPORTED_EXTENSIONS = [
  ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala", ".r",
  ".sql", ".html", ".css", ".scss", ".less", ".xml", ".json", ".yaml", ".yml",
  ".sh", ".bash", ".ps1", ".bat", ".cmd", ".lua", ".perl", ".pl",
  ".m", ".mm", ".dart", ".vue", ".svelte", ".zig", ".nim", ".v",
  ".asm", ".s", ".f90", ".f95", ".pas", ".vb", ".vbs",
  ".txt", ".md", ".csv", ".log", ".ini", ".cfg", ".conf", ".toml",
  ".dockerfile", ".makefile", ".cmake", ".gradle", ".sbt",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

const PlagioCodigoPage = () => {
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
   const [selectedCase, setSelectedCase] = useState("none");
   const [githubToken, setGithubToken] = useState("");
   const [repoUrlA, setRepoUrlA] = useState("");
   const [repoUrlB, setRepoUrlB] = useState("");
   const [fetchingGithub, setFetchingGithub] = useState<"A" | "B" | null>(null);
   const fetchGithubRepo = async (side: "A" | "B") => {
     const url = side === "A" ? repoUrlA : repoUrlB;
     if (!url) {
       toast({ title: "Atenção", description: "Informe a URL do repositório GitHub.", variant: "destructive" });
       return;
     }
 
     setFetchingGithub(side);
     try {
       // Extract owner/repo from URL
       const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
       if (!match) throw new Error("URL do GitHub inválida. Use o formato: https://github.com/usuario/repositorio");
       
       const [, owner, repo] = match;
       const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json" };
       if (githubToken) headers["Authorization"] = `token ${githubToken}`;
 
       // For simplicity in a frontend-only context, we'll try to fetch the main content or specific files
       // In a production app, this would ideally go through a backend/Edge Function to handle large repos and recursive fetching
       const apiURL = `https://api.github.com/repos/${owner}/${repo}/contents`;
       const resp = await fetch(apiURL, { headers });
       
       if (!resp.ok) {
         if (resp.status === 401 || resp.status === 403) throw new Error("Acesso negado. Verifique seu Token (necessário para repositórios privados).");
         throw new Error(`Erro ao acessar GitHub: ${resp.statusText}`);
       }
 
       const contents = await resp.json();
       // Filter for code files and take the first few as a sample for analysis
       // Real implementation would likely analyze the entire tree
       const codeFiles = contents.filter((f: any) => 
         f.type === "file" && SUPPORTED_EXTENSIONS.some(ext => f.name.endsWith(ext))
       ).slice(0, 5);
 
       if (codeFiles.length === 0) throw new Error("Nenhum arquivo de código suportado encontrado na raiz do repositório.");
 
       let combinedCode = "";
       for (const file of codeFiles) {
         const fResp = await fetch(file.download_url);
         const text = await fResp.text();
         combinedCode += `// ARQUIVO: ${file.name}\n${text}\n\n`;
       }
 
       if (side === "A") setCodeA(combinedCode);
       else setCodeB(combinedCode);
 
       toast({ title: "Repositório carregado", description: `${codeFiles.length} arquivos extraídos do GitHub.` });
     } catch (err: any) {
       toast({ title: "Erro no GitHub", description: err.message, variant: "destructive" });
     } finally {
       setFetchingGithub(null);
     }
   };
 
             <div className="mb-6 space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
               <div className="flex items-center gap-2 mb-2">
                 <Github className="h-5 w-5 text-primary" />
                 <h3 className="text-sm font-bold text-white">Integração GitHub</h3>
                 <span className="text-[10px] text-white/20 uppercase tracking-widest ml-auto">Autenticação opcional</span>
               </div>
               <div className="space-y-2">
                 <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold">Personal Access Token (Opcional)</label>
                 <Input 
                   type="password" 
                   placeholder="ghp_xxxxxxxxxxxx" 
                   value={githubToken}
                   onChange={(e) => setGithubToken(e.target.value)}
                   className="bg-black/40 border-white/10 h-10 rounded-xl focus:border-primary/40 transition-all text-xs"
                 />
                 <p className="text-[10px] text-white/20">Necessário para repositórios privados ou para evitar limites de taxa (rate limiting).</p>
               </div>
             </div>
 
             <div className="space-y-6">
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <label className="text-sm font-bold text-white/80">Código A — Repositório ou Texto</label>
                   <div className="flex gap-2">
                     <Input 
                       placeholder="URL do Repo A" 
                       value={repoUrlA}
                       onChange={(e) => setRepoUrlA(e.target.value)}
                       className="h-8 text-xs bg-white/5 border-white/5 w-48 rounded-lg"
                     />
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => fetchGithubRepo("A")} 
                       disabled={fetchingGithub === "A"}
                       className="h-8 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all rounded-lg"
                     >
                       {fetchingGithub === "A" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Github className="h-3 w-3" />}
                     </Button>
                   </div>
                 </div>
                 {renderCodeInput("A", "", codeA, setCodeA, fileA, fileRefA, "Cole aqui ou carregue via GitHub...")}
               </div>
 
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <label className="text-sm font-bold text-white/80">Código B — Repositório ou Texto</label>
                   <div className="flex gap-2">
                     <Input 
                       placeholder="URL do Repo B" 
                       value={repoUrlB}
                       onChange={(e) => setRepoUrlB(e.target.value)}
                       className="h-8 text-xs bg-white/5 border-white/5 w-48 rounded-lg"
                     />
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => fetchGithubRepo("B")} 
                       disabled={fetchingGithub === "B"}
                       className="h-8 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all rounded-lg"
                     >
                       {fetchingGithub === "B" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Github className="h-3 w-3" />}
                     </Button>
                   </div>
                 </div>
                 {renderCodeInput("B", "", codeB, setCodeB, fileB, fileRefB, "Cole aqui ou carregue via GitHub...")}
               </div>
             </div>
 
             <div className="pt-4">
               {/* Original inputs below are replaced by the new section above */}
  const fileRefA = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);

  const handleFileSelect = (side: "A" | "B") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Arquivo muito grande", description: `O limite é 100 MB. Este arquivo tem ${formatFileSize(file.size)}.`, variant: "destructive" });
      return;
    }

    if (side === "A") {
      setFileA(file);
      readFileAsText(file).then(setCodeA).catch(() => {
        toast({ title: "Erro ao ler arquivo", description: "Não foi possível ler o conteúdo do arquivo.", variant: "destructive" });
        setFileA(null);
      });
    } else {
      setFileB(file);
      readFileAsText(file).then(setCodeB).catch(() => {
        toast({ title: "Erro ao ler arquivo", description: "Não foi possível ler o conteúdo do arquivo.", variant: "destructive" });
        setFileB(null);
      });
    }
  };

  const removeFile = (side: "A" | "B") => {
    if (side === "A") { setFileA(null); setCodeA(""); }
    else { setFileB(null); setCodeB(""); }
  };

  const handleAnalyze = async () => {
    if (!codeA.trim() || !codeB.trim()) {
      toast({ title: "Atenção", description: "Forneça ambos os códigos (cole ou envie arquivos) para comparação.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");

    const fileInfoA = fileA ? `[Arquivo: ${fileA.name}, ${formatFileSize(fileA.size)}]` : "";
    const fileInfoB = fileB ? `[Arquivo: ${fileB.name}, ${formatFileSize(fileB.size)}]` : "";

    const prompt = `${context ? `CONTEXTO: ${context}\n\n` : ""}CÓDIGO A (ORIGINAL/REFERÊNCIA) ${fileInfoA}:\n\`\`\`\n${codeA}\n\`\`\`\n\nCÓDIGO B (SUSPEITO) ${fileInfoB}:\n\`\`\`\n${codeB}\n\`\`\``;

    await streamForensicAnalysis({
      type: "plagio-codigo" as any,
      content: prompt,
      onDelta: (text) => setResult((prev) => prev + text),
      onDone: () => setLoading(false),
      onError: (err) => {
        setLoading(false);
        toast({ title: "Erro na análise", description: err, variant: "destructive" });
      },
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCodeInput = (
    side: "A" | "B",
    label: string,
    code: string,
    setCode: (v: string) => void,
    file: File | null,
    fileRef: React.RefObject<HTMLInputElement>,
    placeholder: string,
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <input
          ref={fileRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(",")}
          onChange={handleFileSelect(side)}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="gap-1.5 h-7 text-xs border-border text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-3 w-3" />
          Enviar arquivo
        </Button>
      </div>

      {file && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs">
          <File className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-foreground truncate flex-1">{file.name}</span>
          <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
          <button onClick={() => removeFile(side)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Textarea
        placeholder={placeholder}
        value={code}
        onChange={(e) => { setCode(e.target.value); if (side === "A") setFileA(null); else setFileB(null); }}
        className="min-h-[160px] bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm"
      />
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Análise de Plágio de Código-Fonte</h1>
      <p className="text-muted-foreground mb-2">
        Compare dois trechos de código para identificar similaridades, cópias e plágio.
      </p>
      <p className="text-xs text-muted-foreground/70 mb-6">
        Suporte a arquivos de até 100 MB — cole o código diretamente ou envie arquivos-fonte.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            {renderCodeInput("A", "Código A — Original / Referência", codeA, setCodeA, fileA, fileRefA, "Cole aqui o código-fonte original ou de referência...")}
            {renderCodeInput("B", "Código B — Suspeito", codeB, setCodeB, fileB, fileRefB, "Cole aqui o código-fonte suspeito de plágio...")}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Contexto adicional <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea
                placeholder="Ex: linguagem utilizada, disciplina, informações sobre os autores..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[60px] bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
              ) : (
                <><Code2 className="h-4 w-4" /> Analisar Plágio</>
              )}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Parecer Técnico</h3>
            <div className="flex gap-1">
              {result && !loading && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  setSaving(true);
                  await saveEvidence({
                    module: "plagio-codigo",
                    title: `Plágio de Código — ${new Date().toLocaleString("pt-BR")}`,
                    inputContent: (fileA ? `[${fileA.name}]\n` : "") + codeA.slice(0, 500) + "\n---\n" + (fileB ? `[${fileB.name}]\n` : "") + codeB.slice(0, 500),
                    resultContent: result,
                    caseId: selectedCase !== "none" ? selectedCase : undefined,
                  });
                  setSaving(false);
                  toast({ title: "Evidência salva na cadeia de custódia!" });
                }} disabled={saving} className="text-muted-foreground hover:text-foreground gap-1.5 h-8">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              )}
              {result && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:text-foreground gap-1.5 h-8">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </div>
          </div>
          <div className="min-h-[200px] max-h-[500px] overflow-auto text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {result || (
              <span className="text-muted-foreground italic">
                {loading ? "Comparando códigos-fonte..." : "O parecer aparecerá aqui após a análise."}
              </span>
            )}
            {loading && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlagioCodigoPage;
