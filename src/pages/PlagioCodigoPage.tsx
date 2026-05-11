import { useState } from "react";
import { Loader2, Copy, Check, Code2, Save, X, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { toast } from "@/hooks/use-toast";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

const PlagioCodigoPage = () => {
  const [codeA, setCodeA] = useState("");
  const [codeB, setCodeB] = useState("");
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
      // Robust GitHub URL parsing
      const cleanUrl = url.trim().replace(/\/$/, "");
      const urlMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!urlMatch) throw new Error("URL do GitHub inválida. Use o formato: github.com/usuario/repositorio");
      
      const owner = urlMatch[1];
      const repo = urlMatch[2].replace(".git", "");
      
      const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json" };
      if (githubToken) headers["Authorization"] = `token ${githubToken}`;

      const apiURL = `https://api.github.com/repos/${owner}/${repo}/contents`;
      const resp = await fetch(apiURL, { headers });
      
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) throw new Error("Acesso negado. Verifique seu Token (necessário para repositórios privados).");
        throw new Error(`Erro ao acessar GitHub: ${resp.statusText}`);
      }

       const fetchFilesRecursively = async (path: string = "", depth: number = 0): Promise<any[]> => {
         if (depth > 3) return []; // Limit depth for performance
         const contentResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
         if (!contentResp.ok) return [];
         const items = await contentResp.json();
         let files: any[] = [];
         
         for (const item of items) {
           if (item.type === "file" && /\.(py|js|ts|tsx|jsx|java|c|cpp|h|cs|go|rs|php|swift|kt|sql|html|css|sh|lua|txt)$/i.test(item.name)) {
             // Avoid large build artifacts or configs
             if (!item.path.includes("node_modules") && !item.path.includes("dist") && !item.path.includes(".next")) {
               files.push(item);
             }
           } else if (item.type === "dir" && depth < 2) { // Only dive into common source dirs
             const subFiles = await fetchFilesRecursively(item.path, depth + 1);
             files = [...files, ...subFiles];
           }
           if (files.length >= 15) break; // Limit total files
         }
         return files;
       };
 
       const codeFiles = (await fetchFilesRecursively()).slice(0, 15);
 
       if (codeFiles.length === 0) throw new Error("Nenhum arquivo de código relevante encontrado.");
 
       let combinedCode = "";
       for (const file of codeFiles) {
         const fResp = await fetch(file.download_url);
         const text = await fResp.text();
         combinedCode += `// ARQUIVO: ${file.path}\n${text}\n\n`;
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

  const handleAnalyze = async () => {
    if (!codeA.trim() || !codeB.trim()) {
      toast({ title: "Atenção", description: "Importe ambos os repositórios para comparação.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");

    const prompt = `[ANÁLISE PERICIAL DE PLÁGIO DE SOFTWARE]\n\nREPOSITÓRIO A (REFERÊNCIA): ${repoUrlA}\nREPOSITÓRIO B (SUSPEITO): ${repoUrlB}\nCONTEXTO: ${context}\n\nCÓDIGO A:\n${codeA.slice(0, 15000)}\n\nCÓDIGO B:\n${codeB.slice(0, 15000)}`;

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

  const renderCodeStatus = (side: "A" | "B", code: string) => {
    if (!code) return (
      <div className="flex flex-col items-center justify-center h-[160px] bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
        <Github className="h-8 w-8 text-white/10 mb-2" />
        <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Aguardando Importação</p>
      </div>
    );

    return (
      <div className="relative group">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase font-bold">
            Importado via GitHub
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => side === "A" ? setCodeA("") : setCodeB("")}
            className="h-6 w-6 p-0 rounded-full bg-black/60 hover:bg-red-500/20 text-white/40 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="min-h-[160px] max-h-[160px] overflow-auto bg-white/[0.03] border border-white/10 rounded-2xl p-4 font-mono text-[11px] text-white/60 leading-relaxed custom-scrollbar">
          {code}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Análise de Plágio de Código-Fonte</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Compare repositórios GitHub de forma segura para identificar similaridades e plágio.
      </p>

       <div className="grid gap-8 lg:grid-cols-2">
         <div className="space-y-6">
           <div className="glass-card rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <Code2 className="h-24 w-24" />
             </div>
            <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 shadow-premium-sm">
              <div className="flex items-center gap-2 mb-1">
                <Github className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-white">Integração GitHub</h3>
                <span className="text-[10px] text-white/20 uppercase tracking-widest ml-auto font-bold">Traceability</span>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold">Personal Access Token</label>
                <Input 
                  type="password" 
                  placeholder="ghp_xxxxxxxxxxxx" 
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="bg-black/40 border-white/10 h-10 rounded-xl focus:border-primary/40 transition-all text-xs"
                />
                <p className="text-[10px] text-white/20 italic">Obrigatório para repositórios privados e maior limite de taxa.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 space-y-4 transition-all hover:border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-glow-sm">A</div>
                    <label className="text-xs font-bold text-white/60 uppercase tracking-widest">Código de Referência</label>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="github.com/org/repo-a" 
                      value={repoUrlA}
                      onChange={(e) => setRepoUrlA(e.target.value)}
                      className="h-9 text-xs bg-black/40 border-white/10 w-48 rounded-xl focus:border-primary/50 transition-all"
                    />
                    <Button 
                      onClick={() => fetchGithubRepo("A")} 
                      disabled={fetchingGithub === "A" || !githubToken}
                      className="h-9 w-9 p-0 bg-primary text-black hover:bg-white transition-all rounded-xl shadow-glow-sm"
                    >
                      {fetchingGithub === "A" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {renderCodeStatus("A", codeA)}
              </div>

              <div className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 space-y-4 transition-all hover:border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-glow-sm">B</div>
                    <label className="text-xs font-bold text-white/60 uppercase tracking-widest">Código Suspeito</label>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="github.com/org/repo-b" 
                      value={repoUrlB}
                      onChange={(e) => setRepoUrlB(e.target.value)}
                      className="h-9 text-xs bg-black/40 border-white/10 w-48 rounded-xl focus:border-primary/50 transition-all"
                    />
                    <Button 
                      onClick={() => fetchGithubRepo("B")} 
                      disabled={fetchingGithub === "B" || !githubToken}
                      className="h-9 w-9 p-0 bg-primary text-black hover:bg-white transition-all rounded-xl shadow-glow-sm"
                    >
                      {fetchingGithub === "B" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {renderCodeStatus("B", codeB)}
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Contexto Adicional</label>
              <Textarea
                placeholder="Descreva particularidades do caso (linguagens, datas de criação, etc)..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[80px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/20 resize-none rounded-2xl"
              />
            </div>

            <CaseSelector value={selectedCase} onChange={setSelectedCase} />

            <Button
              onClick={handleAnalyze}
              disabled={loading || !codeA || !codeB}
              className="w-full bg-primary text-black font-bold h-12 rounded-2xl hover:bg-white transition-all shadow-glow-md"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Analisando semelhanças...</>
              ) : (
                <><Code2 className="h-5 w-5 mr-2" /> Iniciar Análise de Plágio</>
              )}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 relative border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-widest">Parecer Técnico Forense</h3>
            <div className="flex gap-2">
              {result && !loading && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  setSaving(true);
                  await saveEvidence({
                    module: "plagio-codigo",
                    title: `Perícia de Software: ${repoUrlB.split('/').pop()}`,
                    inputContent: `Origem A: ${repoUrlA}\nOrigem B: ${repoUrlB}\n\nCadeia de custódia via GitHub Auth Token.`,
                    resultContent: result,
                    caseId: selectedCase !== "none" ? selectedCase : undefined,
                    metadata: { repoUrlA, repoUrlB, context }
                  });
                  setSaving(false);
                  toast({ title: "Evidência salva na cadeia de custódia!" });
                }} disabled={saving} className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9 rounded-xl border border-white/5 transition-all">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-primary" />}
                  Salvar Laudo
                </Button>
              )}
              {result && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="text-white/60 hover:text-white hover:bg-white/10 gap-2 h-9 rounded-xl border border-white/5 transition-all">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </Button>
              )}
            </div>
          </div>
          <div className="min-h-[400px] max-h-[800px] overflow-auto text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap custom-scrollbar">
            {result || (
              <div className="h-full flex flex-col items-center justify-center opacity-30 py-20">
                <Code2 className="h-12 w-12 mb-4" />
                <p className="text-sm italic">O parecer técnico detalhado será gerado aqui após a análise comparativa dos repositórios.</p>
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
