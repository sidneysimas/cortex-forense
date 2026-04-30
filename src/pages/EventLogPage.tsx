import { useState, useRef } from "react";
import {
  Monitor, Upload, Loader2, Shield, AlertTriangle, Search,
  Save, Copy, Check, Activity, FileDown, Clock, Server, Eye, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveEvidence, logAudit } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

interface EvtxEvent {
  recordId: number;
  timestamp: string;
  eventId: number;
  level: number;
  levelName: string;
  channel: string;
  provider: string;
  computer: string;
  rawXml: string;
  processId: number;
  threadId: number;
  userData: Record<string, string>;
}

interface EvtxAnalysis {
  fileInfo: {
    chunkCount: number;
    eventCount: number;
    fileSize: number;
    firstEvent: string;
    lastEvent: string;
    duration: number;
    majorVersion: number;
    minorVersion: number;
  };
  events: EvtxEvent[];
  iocs: {
    eventIdDistribution: Record<number, number>;
    levelDistribution: Record<string, number>;
    channelDistribution: Record<string, number>;
    providerDistribution: Record<string, number>;
    computerNames: string[];
    topEventIds: { eventId: number; count: number; description: string }[];
    suspiciousFindings: string[];
    securityEvents: {
      logonAttempts: number;
      failedLogons: number;
      accountLockouts: number;
      privilegeEscalation: number;
      serviceInstalls: number;
      policyChanges: number;
      processCreation: number;
      powershellExec: number;
      scheduledTasks: number;
      firewallChanges: number;
    };
    timelineHotspots: { hour: string; count: number }[];
  };
  statistics: {
    eventsPerSecond: number;
    avgEventSize: number;
    uniqueEventIds: number;
    uniqueProviders: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function levelColor(level: string): string {
  switch (level) {
    case "Critical": return "text-red-500 bg-red-500/10 border-red-500/30";
    case "Error": return "text-destructive bg-destructive/10 border-destructive/30";
    case "Warning": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
    case "Information": return "text-primary bg-primary/10 border-primary/30";
    case "Verbose": return "text-muted-foreground bg-muted/30 border-muted";
    default: return "text-foreground bg-muted/20 border-border";
  }
}

const EventLogPage = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<EvtxAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [filterText, setFilterText] = useState("");
  const [selectedCase, setSelectedCase] = useState("none");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EvtxEvent | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".evtx")) {
      toast({ title: "Formato inválido", description: "Envie um arquivo .evtx (Windows Event Log)", variant: "destructive" });
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite: 200MB", variant: "destructive" });
      return;
    }

    setLoading(true);
    setFileName(file.name);
    setAnalysis(null);
    setSelectedEvent(null);

    await logAudit("evtx_upload", "event-log", { fileName: file.name, fileSize: file.size });

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-evtx`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ base64 }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro na análise" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      setAnalysis(data);
      toast({ title: "Análise concluída", description: `${data.fileInfo.eventCount} eventos extraídos` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveEvidence = async () => {
    if (!analysis) return;
    setSaving(true);
    const summary = [
      `Eventos: ${analysis.fileInfo.eventCount}`,
      `Período: ${new Date(analysis.fileInfo.firstEvent).toLocaleString("pt-BR")} a ${new Date(analysis.fileInfo.lastEvent).toLocaleString("pt-BR")}`,
      `Event IDs únicos: ${analysis.statistics.uniqueEventIds}`,
      `Canais: ${Object.keys(analysis.iocs.channelDistribution).join(", ")}`,
      `\nEventos de Segurança:`,
      `  Logons: ${analysis.iocs.securityEvents.logonAttempts} | Falhas: ${analysis.iocs.securityEvents.failedLogons}`,
      `  Bloqueios: ${analysis.iocs.securityEvents.accountLockouts} | Privilégios: ${analysis.iocs.securityEvents.privilegeEscalation}`,
      `  Serviços: ${analysis.iocs.securityEvents.serviceInstalls} | PowerShell: ${analysis.iocs.securityEvents.powershellExec}`,
      analysis.iocs.suspiciousFindings.length > 0
        ? `\nALERTAS:\n${analysis.iocs.suspiciousFindings.join("\n")}`
        : "",
    ].join("\n");

    await saveEvidence({
      module: "event-log",
      title: `Análise Event Log — ${fileName}`,
      inputContent: `Arquivo: ${fileName}\nTamanho: ${formatBytes(analysis.fileInfo.fileSize)}\nPeríodo: ${new Date(analysis.fileInfo.firstEvent).toLocaleString("pt-BR")} a ${new Date(analysis.fileInfo.lastEvent).toLocaleString("pt-BR")}`,
      resultContent: summary,
      caseId: selectedCase !== "none" ? selectedCase : undefined,
      metadata: {
        evtxFileName: fileName,
        evtxFileSize: analysis.fileInfo.fileSize,
        eventCount: analysis.fileInfo.eventCount,
        topEventIds: analysis.iocs.topEventIds.slice(0, 15),
        securityEvents: analysis.iocs.securityEvents,
        suspiciousFindings: analysis.iocs.suspiciousFindings,
        computerNames: analysis.iocs.computerNames,
      },
    });
    setSaving(false);
    toast({ title: "Evidência salva na cadeia de custódia!" });
  };

  const handleCopyIOCs = () => {
    if (!analysis) return;
    const text = [
      "=== IOCs Extraídos — Windows Event Log ===",
      `\nArquivo: ${fileName}`,
      `Período: ${analysis.fileInfo.firstEvent} — ${analysis.fileInfo.lastEvent}`,
      `\nTop Event IDs:`,
      ...analysis.iocs.topEventIds.slice(0, 20).map(e => `  ${e.eventId}: ${e.count}x — ${e.description}`),
      `\nComputadores: ${analysis.iocs.computerNames.join(", ")}`,
      `\nEventos de Segurança:`,
      `  Logons: ${analysis.iocs.securityEvents.logonAttempts}`,
      `  Falhas de logon: ${analysis.iocs.securityEvents.failedLogons}`,
      `  Bloqueios de conta: ${analysis.iocs.securityEvents.accountLockouts}`,
      `  Escalação de privilégio: ${analysis.iocs.securityEvents.privilegeEscalation}`,
      `  Instalação de serviços: ${analysis.iocs.securityEvents.serviceInstalls}`,
      `  PowerShell: ${analysis.iocs.securityEvents.powershellExec}`,
      analysis.iocs.suspiciousFindings.length > 0 ? `\nAlertas:\n${analysis.iocs.suspiciousFindings.join("\n")}` : "",
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEvents = analysis?.events.filter((evt) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      String(evt.eventId).includes(q) ||
      evt.levelName.toLowerCase().includes(q) ||
      evt.channel.toLowerCase().includes(q) ||
      evt.provider.toLowerCase().includes(q) ||
      evt.computer.toLowerCase().includes(q) ||
      evt.rawXml.toLowerCase().includes(q)
    );
  }) || [];

  const se = analysis?.iocs.securityEvents;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Monitor className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Análise de Event Log (EVTX)</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Upload de arquivos <code className="text-primary">.evtx</code> do Windows para extração de IOCs, eventos de segurança e detecção de anomalias.
      </p>

      {/* Upload */}
      <div className="glass-card rounded-xl p-5 mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Upload de Event Log</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie arquivos <code className="text-primary">.evtx</code> coletados do Windows Event Viewer (Security, System, Application, PowerShell, Sysmon).
          O parser extrai automaticamente Event IDs, níveis de severidade, canais, timestamps e indicadores de comprometimento.
        </p>
        <input ref={fileRef} type="file" accept=".evtx" onChange={handleUpload} className="hidden" />
        <div className="flex gap-3 items-end">
          <Button onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Analisando..." : "Selecionar arquivo .evtx"}
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>
      </div>

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Activity, label: "Eventos", value: analysis.fileInfo.eventCount.toLocaleString() },
              { icon: Shield, label: "Event IDs", value: analysis.statistics.uniqueEventIds.toString() },
              { icon: Clock, label: "Duração", value: formatDuration(analysis.fileInfo.duration) },
              { icon: AlertTriangle, label: "Alertas", value: analysis.iocs.suspiciousFindings.length.toString(), alert: analysis.iocs.suspiciousFindings.length > 0 },
            ].map(({ icon: Icon, label, value, alert }) => (
              <div key={label} className={`glass-card rounded-xl p-4 ${alert ? "border border-destructive/30" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <span className={`text-xl font-bold font-display ${alert ? "text-destructive" : "text-foreground"}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Security Dashboard */}
          {se && (
            <div className="glass-card rounded-xl p-4 mb-6">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" /> Painel de Segurança
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Logons", value: se.logonAttempts, alert: false },
                  { label: "Falhas de Logon", value: se.failedLogons, alert: se.failedLogons > 10 },
                  { label: "Bloqueios", value: se.accountLockouts, alert: se.accountLockouts > 0 },
                  { label: "Escalação", value: se.privilegeEscalation, alert: se.privilegeEscalation > 5 },
                  { label: "Serviços", value: se.serviceInstalls, alert: se.serviceInstalls > 3 },
                  { label: "Políticas", value: se.policyChanges, alert: se.policyChanges > 0 },
                  { label: "Processos", value: se.processCreation, alert: false },
                  { label: "PowerShell", value: se.powershellExec, alert: se.powershellExec > 20 },
                  { label: "Tarefas Agendadas", value: se.scheduledTasks, alert: se.scheduledTasks > 5 },
                  { label: "Firewall", value: se.firewallChanges, alert: se.firewallChanges > 0 },
                ].map(({ label, value, alert }) => (
                  <div key={label} className={`text-center p-2 rounded-lg ${alert ? "bg-destructive/10 border border-destructive/30" : "bg-muted/20"}`}>
                    <div className={`text-lg font-bold font-display ${alert ? "text-destructive" : "text-foreground"}`}>{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Info */}
          <div className="glass-card rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Período:</span><p className="text-foreground">{new Date(analysis.fileInfo.firstEvent).toLocaleString("pt-BR")} — {new Date(analysis.fileInfo.lastEvent).toLocaleString("pt-BR")}</p></div>
              <div><span className="text-muted-foreground">Tamanho:</span><p className="text-foreground">{formatBytes(analysis.fileInfo.fileSize)}</p></div>
              <div><span className="text-muted-foreground">Chunks:</span><p className="text-foreground">{analysis.fileInfo.chunkCount}</p></div>
              <div><span className="text-muted-foreground">Computadores:</span><p className="text-foreground">{analysis.iocs.computerNames.join(", ") || "—"}</p></div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <CaseSelector value={selectedCase} onChange={setSelectedCase} />
            <Button onClick={handleSaveEvidence} disabled={saving} variant="outline" className="gap-2 text-sm h-9">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar evidência
            </Button>
            <Button onClick={handleCopyIOCs} variant="outline" className="gap-2 text-sm h-9">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar IOCs"}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="iocs" className="space-y-4">
            <TabsList className="bg-muted/30">
              <TabsTrigger value="iocs">IOCs</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="alerts">Alertas</TabsTrigger>
            </TabsList>

            {/* IOCs */}
            <TabsContent value="iocs" className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Top Event IDs */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Top Event IDs
                  </h4>
                  <div className="space-y-1 max-h-72 overflow-auto">
                    {analysis.iocs.topEventIds.map((e) => (
                      <div key={e.eventId} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                        <div className="flex items-center gap-2">
                          <code className="text-foreground font-mono font-bold">{e.eventId}</code>
                          <span className="text-muted-foreground truncate max-w-[200px]">{e.description}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-5">{e.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Level Distribution */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" /> Distribuição por Severidade
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(analysis.iocs.levelDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([level, count]) => {
                        const pct = (count / analysis.fileInfo.eventCount) * 100;
                        return (
                          <div key={level} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <Badge variant="outline" className={`text-[10px] h-5 ${levelColor(level)}`}>{level}</Badge>
                              <span className="text-muted-foreground">{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Channel Distribution */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-primary" /> Canais (Logs)
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {Object.entries(analysis.iocs.channelDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .map(([ch, count]) => (
                        <div key={ch} className="flex justify-between text-xs py-1 border-b border-border/20 last:border-0">
                          <span className="text-foreground font-mono">{ch}</span>
                          <span className="text-muted-foreground">{count.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Providers */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary" /> Provedores
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {Object.entries(analysis.iocs.providerDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 20)
                      .map(([prov, count]) => (
                        <div key={prov} className="flex justify-between text-xs py-1 border-b border-border/20 last:border-0">
                          <span className="text-foreground font-mono text-[10px] truncate max-w-[250px]">{prov}</span>
                          <span className="text-muted-foreground">{count.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Events Table */}
            <TabsContent value="events">
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-3 border-b border-border/50 flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por Event ID, canal, nível, provider..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="h-8 text-xs bg-transparent border-0 focus-visible:ring-0"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{filteredEvents.length} eventos</span>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border/50 text-muted-foreground">
                        <th className="text-left p-2 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Timestamp</th>
                        <th className="text-left p-2 font-medium">Event ID</th>
                        <th className="text-left p-2 font-medium">Nível</th>
                        <th className="text-left p-2 font-medium">Canal</th>
                        <th className="text-left p-2 font-medium">Computador</th>
                        <th className="text-left p-2 font-medium">Dados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.slice(0, 500).map((evt) => (
                        <tr
                          key={evt.recordId}
                          onClick={() => setSelectedEvent(evt)}
                          className={`border-b border-border/10 hover:bg-muted/20 cursor-pointer ${
                            selectedEvent?.recordId === evt.recordId ? "bg-primary/10" : ""
                          } ${evt.levelName === "Critical" || evt.levelName === "Error" ? "bg-destructive/5" : ""}`}
                        >
                          <td className="p-2 font-mono text-muted-foreground">{evt.recordId}</td>
                          <td className="p-2 font-mono text-foreground whitespace-nowrap">{new Date(evt.timestamp).toLocaleString("pt-BR")}</td>
                          <td className="p-2 font-mono font-bold text-foreground">{evt.eventId}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={`text-[9px] h-4 px-1 ${levelColor(evt.levelName)}`}>
                              {evt.levelName}
                            </Badge>
                          </td>
                          <td className="p-2 text-foreground">{evt.channel}</td>
                          <td className="p-2 text-muted-foreground font-mono">{evt.computer}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[200px]">{evt.rawXml.slice(0, 60)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Event Detail */}
              {selectedEvent && (
                <div className="glass-card rounded-xl p-4 mt-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3">Detalhes do Evento #{selectedEvent.recordId}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                    <div><span className="text-muted-foreground">Event ID:</span><p className="font-mono font-bold text-foreground">{selectedEvent.eventId}</p></div>
                    <div><span className="text-muted-foreground">Nível:</span><p><Badge variant="outline" className={`text-[10px] ${levelColor(selectedEvent.levelName)}`}>{selectedEvent.levelName}</Badge></p></div>
                    <div><span className="text-muted-foreground">Canal:</span><p className="text-foreground">{selectedEvent.channel}</p></div>
                    <div><span className="text-muted-foreground">Provider:</span><p className="text-foreground font-mono text-[10px]">{selectedEvent.provider || "—"}</p></div>
                    <div><span className="text-muted-foreground">Computador:</span><p className="text-foreground font-mono">{selectedEvent.computer || "—"}</p></div>
                    <div><span className="text-muted-foreground">Process ID:</span><p className="text-foreground font-mono">{selectedEvent.processId || "—"}</p></div>
                    <div><span className="text-muted-foreground">Thread ID:</span><p className="text-foreground font-mono">{selectedEvent.threadId || "—"}</p></div>
                    <div><span className="text-muted-foreground">Timestamp:</span><p className="text-foreground">{new Date(selectedEvent.timestamp).toLocaleString("pt-BR")}</p></div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Dados extraídos:</span>
                    <pre className="text-[10px] font-mono text-foreground/80 bg-muted/20 rounded p-2 mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                      {selectedEvent.rawXml || "Sem dados adicionais"}
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline">
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Hotspots Temporais (por hora)
                </h4>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {analysis.iocs.timelineHotspots.map((h) => {
                    const maxCount = analysis.iocs.timelineHotspots[0]?.count || 1;
                    const pct = (h.count / maxCount) * 100;
                    return (
                      <div key={h.hour} className="flex items-center gap-3 text-xs py-1">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">{h.hour.replace("T", " ")}h</span>
                        <div className="flex-1 h-4 bg-muted/20 rounded overflow-hidden">
                          <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-foreground font-mono w-16 text-right">{h.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Alerts */}
            <TabsContent value="alerts">
              <div className="space-y-3">
                {analysis.iocs.suspiciousFindings.length === 0 ? (
                  <div className="glass-card rounded-xl p-6 text-center">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma anomalia detectada neste log.</p>
                  </div>
                ) : (
                  analysis.iocs.suspiciousFindings.map((finding, i) => (
                    <div key={i} className="glass-card rounded-xl p-4 border border-destructive/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{finding}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default EventLogPage;
