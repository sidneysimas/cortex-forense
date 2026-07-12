import { useState } from "react";
import { Loader2, Play, Save, Copy, Check, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import ChromeUploader, { type UploadedArtifact } from "@/components/chrome/ChromeUploader";
import ChromeDashboard from "@/components/chrome/ChromeDashboard";
import CaseSelector from "@/components/dashboard/CaseSelector";
import {
  parseHistory, parseLoginData, parseWebData, parseCookies, parseBookmarks,
  type ChromeReport,
} from "@/lib/chrome-parsers";
import { buildChromeAiSummary } from "@/lib/chrome-analysis";
import { streamForensicAnalysis } from "@/lib/forensic-api";
import { saveEvidence, logAudit } from "@/lib/audit";

export default function ChromePage() {
  const [files, setFiles] = useState<UploadedArtifact[]>([]);
  const [report, setReport] = useState<ChromeReport | null>(null);
  const [parsing, setParsing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");

  const runParse = async () => {
    if (!files.length) {
      toast({ title: "Nenhum arquivo", description: "Envie ao menos um artefato do Chrome.", variant: "destructive" });
      return;
    }
    setParsing(true);
    setReport(null);
    setAnalysis("");
    try {
      const r: ChromeReport = {
        files: files.map((f) => ({ name: f.name, sha256: f.sha256, size: f.size, kind: f.kind })),
      };
      for (const f of files) {
        const buf = await f.file.arrayBuffer();
        if (f.kind === "history") r.history = await parseHistory(buf);
        else if (f.kind === "login_data") r.logins = await parseLoginData(buf);
        else if (f.kind === "web_data") r.webData = await parseWebData(buf);
        else if (f.kind === "cookies") r.cookies = await parseCookies(buf);
        else if (f.kind === "bookmarks") r.bookmarks = await parseBookmarks(buf);
      }
      setReport(r);
      await logAudit("chrome_parsed", "chrome-forensics", {
        files: files.map((f) => ({ name: f.name, kind: f.kind, sha256: f.sha256 })),
      });
      toast({ title: "Extração concluída", description: `${files.length} arquivo(s) processado(s) localmente.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na extração", description: e?.message || "Falha ao ler artefato.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const runAi = async () => {
    if (!report) return;
    setAnalyzing(true);
    setAnalysis("");
    const summary = buildChromeAiSummary(report);
    let full = "";
    await streamForensicAnalysis({
      type: "chrome-forensics" as any,
      content: summary,
      onDelta: (t) => { full += t; setAnalysis((p) => p + t); },
      onDone: () => { setAnalyzing(false); setAnalysis(full); },
      onError: (err) => {
        setAnalyzing(false);
        toast({ title: "Erro na análise", description: err, variant: "destructive" });
      },
    });
  };

  const handleSave = async () => {
    if (!report || !analysis) return;
    setSaving(true);
    const summary = buildChromeAiSummary(report);
    const combinedHash = files.map((f) => f.sha256).join("|");
    await saveEvidence({
      module: "chrome-forensics",
      title: `Chrome Forensics — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      inputContent: summary,
      resultContent: analysis,
      fileHash: combinedHash.length > 8 ? combinedHash : undefined,
      metadata: {
        files: files.map((f) => ({ name: f.name, kind: f.kind, sha256: f.sha256, size: f.size })),
      },
      caseId: selectedCase !== "none" ? selectedCase : undefined,
    });
    setSaving(false);
    toast({ title: "Evidência registrada na cadeia de custódia" });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Chrome className="h-6 w-6 text-emerald-400" />
        <h1 className="font-display text-2xl font-bold">Chrome Forensics</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Análise pericial de artefatos do Chrome / Edge / Brave (History, Login Data, Web Data, Cookies, Bookmarks) diretamente do perfil do navegador.
      </p>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <ChromeUploader onChange={setFiles} />
            <CaseSelector value={selectedCase} onChange={setSelectedCase} />
            <Button
              onClick={runParse}
              disabled={parsing || files.length === 0}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo artefatos...</> : <><Play className="h-4 w-4" /> Extrair artefatos</>}
            </Button>
          </div>

          {report && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div>
                <h3 className="font-display text-sm font-bold text-white/80 mb-1">Parecer pericial (IA)</h3>
                <p className="text-xs text-white/50">A IA recebe apenas o relatório estruturado — nunca o SQLite bruto.</p>
              </div>
              <Button onClick={runAi} disabled={analyzing} className="w-full gap-2">
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : <>Gerar parecer com IA</>}
              </Button>
              {analysis && !analyzing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1 gap-1.5">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar evidência
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {report ? (
            <ChromeDashboard report={report} />
          ) : (
            <div className="glass-card rounded-xl p-10 text-center text-white/40 text-sm">
              Envie os arquivos do perfil e clique em "Extrair artefatos" para visualizar métricas, heatmap de atividade, top domínios, PII e credenciais salvas.
            </div>
          )}

          {(analyzing || analysis) && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display text-sm font-bold text-white/80 mb-3">Parecer forense</h3>
              <div className="text-sm whitespace-pre-wrap text-white/90 leading-relaxed max-h-[600px] overflow-y-auto">
                {analysis || <span className="text-white/40 italic">Processando parecer...</span>}
                {analyzing && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
