 import { useState, useEffect } from "react";
 import { useSearchParams } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { sendNotification } from "@/lib/notifications";
 import { logEvidenceAccess } from "@/lib/audit";
 import { useAuth } from "@/hooks/useAuth";
 import {
   Loader2, Database, Eye, ShieldCheck, FileDown, FileText, Link2,
   Filter, History, Award, BookOpen, Users, Clock, Fingerprint, Download
 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Evidence {
  id: string;
  module: string;
  title: string;
  input_content: string;
  result_content: string;
  file_hash: string;
  created_at: string;
  created_at_brt?: string;
  case_id?: string;
  tsa_timestamp?: string;
  tsa_token?: string;
  blockchain_tx?: string;
  blockchain_network?: string;
  verification_url?: string;
  metadata?: any;
  file_path?: string;
}

interface AccessLog {
  id: string;
  action: string;
  user_agent: string;
  justification: string | null;
  created_at: string;
  created_at_brt?: string;
  user_id: string;
}

const formatBrt = (date?: string | null, brt?: string | null) =>
  brt || (date ? `${new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (BRT)` : "—");

const moduleLabels: Record<string, string> = {
  grafotecnia: "Grafotecnia",
  hives: "Leitura de Hives",
  documental: "Análise Documental",
  laudo: "Geração de Laudos",
  "plagio-codigo": "Plágio de Código",
  "email-pst": "Análise de E-mails",
  "web-capture": "Captura Web",
  "analise-imagem": "Análise de Imagens",
  quesitos: "Quesitos",
};

const actionLabels: Record<string, string> = {
  view: "Visualização",
  export: "Exportação",
  certify: "Certificação",
  modify: "Modificação",
  share: "Compartilhamento",
};

const EvidencesPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [certifying, setCertifying] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState<string | null>(null);

  const handleDownloadOriginal = async (ev: Evidence) => {
    if (!ev.file_path) return;
    const { data, error } = await supabase.storage.from("forensic-files").createSignedUrl(ev.file_path, 60);
    if (error) {
      toast({ title: "Erro ao baixar arquivo", description: error.message, variant: "destructive" });
      return;
    }
    
    // Safer download using a temporary anchor
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.setAttribute('download', ev.file_path.split('/').pop() || 'evidence');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    await logEvidenceAccess(ev.id, "export", "Download do arquivo original da evidência");
  };

  // Filters
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCase, setFilterCase] = useState(searchParams.get("case") || "all");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("cases").select("id, title").eq("user_id", user.id).then(({ data }) => {
      if (data) setCases(data as any[]);
    });
  }, [user]);

  const fetchEvidences = () => {
    if (!user) return;
    supabase
      .from("evidences")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setEvidences((data as unknown as Evidence[]) || []);
        setLoading(false);
      });
  };

  useEffect(() => { fetchEvidences(); }, [user]);

  const isCertified = (ev: Evidence) => !!(ev.tsa_timestamp || ev.blockchain_tx);
  const isIsoCompliant = (ev: Evidence) => ev.metadata?.iso27037?.compliance === true;

  const filtered = evidences.filter((ev) => {
    if (filterModule !== "all" && ev.module !== filterModule) return false;
    if (filterStatus === "certified" && !isCertified(ev)) return false;
    if (filterStatus === "pending" && isCertified(ev)) return false;
    if (filterCase !== "all" && ev.case_id !== filterCase) return false;
    if (filterSearch && !ev.title?.toLowerCase().includes(filterSearch.toLowerCase()) && !ev.module.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const handleViewEvidence = async (ev: Evidence) => {
    setSelected(ev);
    await logEvidenceAccess(ev.id, "view", "Visualização da evidência na cadeia de custódia");
    // Fetch access logs
    setLoadingLogs(true);
    const { data } = await supabase.from("evidence_access_log" as any)
      .select("*")
      .eq("evidence_id", ev.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAccessLogs((data as unknown as AccessLog[]) || []);
    setLoadingLogs(false);
  };

  const handleCertify = async (ev: Evidence) => {
    setCertifying(ev.id);
    try {
      const { data, error } = await supabase.functions.invoke("certify-evidence", { body: { evidenceId: ev.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Evidência certificada", description: "TSA e blockchain aplicados conforme ISO 27037." });
      await logEvidenceAccess(ev.id, "certify", "Certificação com TSA e blockchain");
      sendNotification({
        type: "certification_complete",
        subject: `Evidência certificada: ${ev.title}`,
        body: `A evidência "${ev.title}" (módulo: ${ev.module}) foi certificada com TSA e blockchain conforme ABNT NBR ISO/IEC 27037:2013.\n\nHash: ${ev.file_hash}\nData: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        evidenceId: ev.id,
        caseId: ev.case_id,
      });
      fetchEvidences();
    } catch (err: any) {
      toast({ title: "Erro na certificação", description: err.message, variant: "destructive" });
    } finally { setCertifying(null); }
  };

  const handleExportPdf = async (ev: Evidence) => {
    setExporting(ev.id);
    try {
      await logEvidenceAccess(ev.id, "export", "Exportação em formato PDF");
      const { data, error } = await supabase.functions.invoke("export-evidence-pdf", { body: { evidenceId: ev.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const blob = new Blob([data.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) win.addEventListener("load", () => setTimeout(() => win.print(), 500));
      toast({ title: "PDF gerado", description: "Use Ctrl+P para salvar como PDF." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setExporting(null); }
  };

  const handleExportDocx = async (ev: Evidence) => {
    setExportingDocx(ev.id);
    try {
      await logEvidenceAccess(ev.id, "export", "Exportação em formato DOCX");
      const { data, error } = await supabase.functions.invoke("export-laudo-docx", { body: { evidenceId: ev.id } });
      if (error) throw new Error(error.message);
      const blob = new Blob([data], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laudo-${ev.id.slice(0, 8)}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Laudo exportado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setExportingDocx(null); }
  };

  const getCaseTitle = (caseId?: string) => {
    if (!caseId) return null;
    return cases.find((c) => c.id === caseId)?.title || null;
  };

  const isoStats = {
    total: evidences.length,
    compliant: evidences.filter(isIsoCompliant).length,
    certified: evidences.filter(isCertified).length,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Cadeia de Custódia</h1>
      </div>
      <p className="text-muted-foreground mb-4">
        Registro imutável com hash SHA-256, carimbo de tempo (TSA) e ancoragem blockchain — conforme ABNT NBR ISO/IEC 27037:2013.
      </p>

      {/* ISO 27037 Compliance Banner */}
      <div className="glass-card rounded-xl p-4 mb-6 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Award className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-sm font-semibold text-foreground">Conformidade ABNT NBR ISO/IEC 27037:2013</h3>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                Em conformidade
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Diretrizes para identificação, coleta, aquisição e preservação de evidência digital.
              Princípios atendidos: <strong>Auditabilidade</strong>, <strong>Repetibilidade</strong>, <strong>Reprodutibilidade</strong> e <strong>Justificabilidade</strong>.
            </p>
            <div className="flex gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Fingerprint className="h-3.5 w-3.5 text-primary" />
                <span>{isoStats.compliant}/{isoStats.total} com metadados ISO</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                <span>{isoStats.certified} certificadas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ISO 27037 Principles Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: BookOpen, title: "Auditabilidade", desc: "Todos os processos documentados com logs" },
          { icon: Fingerprint, title: "Repetibilidade", desc: "Hash SHA-256 verificável a qualquer tempo" },
          { icon: Database, title: "Reprodutibilidade", desc: "Dados preservados no formato original" },
          { icon: Users, title: "Justificabilidade", desc: "Ações registradas com agente e dispositivo" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{title}</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          <span className="text-xs text-muted-foreground">({filtered.length} de {evidences.length})</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Buscar por título..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="bg-muted/30 border-border/60 h-9 text-sm"
          />
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="bg-muted/30 border-border/60 h-9 text-sm"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {Object.entries(moduleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-muted/30 border-border/60 h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="certified">Certificadas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCase} onValueChange={setFilterCase}>
            <SelectTrigger className="bg-muted/30 border-border/60 h-9 text-sm"><SelectValue placeholder="Caso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os casos</SelectItem>
              {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {evidences.length === 0 ? "Nenhuma evidência registrada." : "Nenhuma evidência encontrada com os filtros aplicados."}
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Módulo</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Título</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Caso</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Hash</th>
                <th className="text-left p-3 text-muted-foreground font-medium">ISO</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr key={ev.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="p-3 text-foreground/80 whitespace-nowrap">{formatBrt(ev.created_at, ev.created_at_brt)}</td>
                  <td className="p-3 text-foreground">{moduleLabels[ev.module] || ev.module}</td>
                  <td className="p-3 text-foreground max-w-xs truncate">{ev.title || "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[120px] truncate">{getCaseTitle(ev.case_id) || "—"}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs max-w-[100px] truncate">
                    {ev.file_hash ? ev.file_hash.slice(0, 12) + "..." : "—"}
                  </td>
                  <td className="p-3">
                    {isIsoCompliant(ev) ? (
                      <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">27037</Badge>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {isCertified(ev) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="h-3 w-3" /> Certificado
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pendente</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleViewEvidence(ev)} className="gap-1 text-primary h-7 px-2">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {!isCertified(ev) && ev.file_hash && (
                        <Button variant="ghost" size="sm" onClick={() => handleCertify(ev)} disabled={certifying === ev.id} className="gap-1 text-primary h-7 px-2" title="Certificar">
                          {certifying === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                       <Button variant="ghost" size="sm" onClick={() => handleExportPdf(ev)} disabled={exporting === ev.id} className="gap-1 text-primary h-7 px-2" title="PDF">
                         {exporting === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => handleExportDocx(ev)} disabled={exportingDocx === ev.id} className="gap-1 text-primary h-7 px-2" title="Word">
                         {exportingDocx === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                       </Button>
                       {ev.file_path && (
                         <Button variant="ghost" size="sm" onClick={() => handleDownloadOriginal(ev)} className="gap-1 text-primary h-7 px-2" title="Download Original">
                           <Download className="h-3.5 w-3.5" />
                         </Button>
                       )}
                      <Link to={`/dashboard/versoes?id=${ev.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7 px-2" title="Histórico">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Evidence Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {selected && (moduleLabels[selected.module] || selected.module)} — {selected?.title}
              {selected && isIsoCompliant(selected) && (
                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">ISO 27037</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div><span className="text-muted-foreground font-medium">Data:</span> {formatBrt(selected.created_at, selected.created_at_brt)}</div>
              {getCaseTitle(selected.case_id) && (
                <div><span className="text-muted-foreground font-medium">Caso:</span> {getCaseTitle(selected.case_id)}</div>
              )}
              {selected.file_hash && (
                <div>
                  <span className="text-muted-foreground font-medium">Hash SHA-256:</span>
                  <code className="block mt-1 p-2 bg-muted/50 rounded text-xs font-mono break-all">{selected.file_hash}</code>
                </div>
              )}

              {selected.file_path && (
                <div>
                  <span className="text-muted-foreground font-medium">Arquivo Original:</span>
                  <div className="mt-2 flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadOriginal(selected)} className="gap-2 text-xs border-primary/20 hover:border-primary/50 transition-all">
                      <Download className="h-3.5 w-3.5 text-primary" /> Baixar arquivo original
                    </Button>
                    <span className="text-[10px] text-white/30 font-mono truncate flex-1">{selected.file_path}</span>
                  </div>
                </div>
              )}

              {/* ISO 27037 Metadata */}
              {isIsoCompliant(selected) && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-primary font-medium text-xs">
                    <Award className="h-4 w-4" /> Metadados ISO/IEC 27037:2013
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Aquisição:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.acquisition?.timestampBR || formatBrt(selected.created_at, selected.created_at_brt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Agente:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.acquisition?.agent || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Método:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.acquisition?.method || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Algoritmo de hash:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.acquisition?.hashAlgorithm || "SHA-256"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preservação:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.chainOfCustody?.preservationMethod || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fuso:</span>
                      <p className="text-foreground/80">{selected.metadata.iso27037.chainOfCustody?.timezone || "America/Sao_Paulo"}</p>
                    </div>
                  </div>
                  {selected.metadata.iso27037.acquisition?.device && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Dispositivo de aquisição:</span>
                      <p className="text-foreground/80 font-mono text-[10px] mt-0.5">
                        {selected.metadata.iso27037.acquisition.device.platform} | {selected.metadata.iso27037.acquisition.device.timezone} | {selected.metadata.iso27037.acquisition.device.screenResolution}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isCertified(selected) && (
                <div className="p-3 bg-green-400/5 border border-green-400/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-green-400 font-medium"><ShieldCheck className="h-4 w-4" /> Evidência Certificada</div>
                  {selected.tsa_timestamp && <div><span className="text-muted-foreground text-xs">TSA:</span><p className="text-xs font-mono text-foreground/80">{selected.tsa_timestamp}</p></div>}
                  {selected.blockchain_tx && (
                    <div>
                      <span className="text-muted-foreground text-xs">Blockchain TX:</span>
                      <code className="block text-xs font-mono text-foreground/80 break-all">{selected.blockchain_tx}</code>
                      <span className="text-muted-foreground text-xs">Rede: {selected.blockchain_network}</span>
                    </div>
                  )}
                  {selected.verification_url && (
                    <div className="flex items-center gap-1 text-xs">
                      <Link2 className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">Verificação:</span>
                      <span className="text-primary font-mono">{selected.verification_url}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Chain of Custody Access Log */}
              <div className="p-3 bg-muted/20 border border-border/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Registro de Acesso — Cadeia de Custódia (ISO 27037 §2.1)</span>
                </div>
                {loadingLogs ? (
                  <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                ) : accessLogs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">Nenhum registro de acesso encontrado.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {accessLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5 border-b border-border/20 last:border-0">
                        <span className="text-foreground/70 whitespace-nowrap">{formatBrt(log.created_at, log.created_at_brt)}</span>
                        <Badge variant="outline" className="text-[8px] h-4 px-1.5">{actionLabels[log.action] || log.action}</Badge>
                        {log.justification && <span className="truncate">— {log.justification}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Screenshot if web-capture */}
              {selected.module === "web-capture" && selected.metadata?.screenshotBase64 && (
                <div>
                  <span className="text-muted-foreground font-medium">Screenshot:</span>
                  <img src={selected.metadata.screenshotBase64} alt="Screenshot" className="mt-1 rounded-lg border border-border/50 w-full" />
                </div>
              )}
              <div>
                <span className="text-muted-foreground font-medium">Entrada:</span>
                <pre className="mt-1 p-3 bg-muted/30 rounded text-xs whitespace-pre-wrap max-h-40 overflow-auto">{selected.input_content || "—"}</pre>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Resultado da Análise:</span>
                <pre className="mt-1 p-3 bg-muted/30 rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto">{selected.result_content || "—"}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EvidencesPage;
