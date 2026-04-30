import { useState, useRef } from "react";
import {
  Network, Upload, Loader2, Shield, Globe, Server, Activity,
  AlertTriangle, Search, FileDown, Save, Copy, Check, Wifi,
  ArrowRightLeft, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveEvidence, logAudit } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

interface PcapAnalysis {
  fileInfo: {
    version: string;
    linkType: number;
    snapLen: number;
    packetCount: number;
    fileSize: number;
    duration: number;
    startTime: string;
    endTime: string;
  };
  packets: {
    timestamp: number;
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
    protocol: string;
    protocolNumber: number;
    length: number;
    flags?: string;
    info?: string;
  }[];
  iocs: {
    uniqueSrcIps: string[];
    uniqueDstIps: string[];
    uniquePorts: number[];
    protocols: Record<string, number>;
    topTalkers: { ip: string; packets: number; bytes: number }[];
    connections: { src: string; dst: string; port: number; protocol: string; count: number }[];
    dnsQueries: { name: string; type: string; timestamp: number }[];
    suspiciousFindings: string[];
  };
  statistics: {
    totalBytes: number;
    avgPacketSize: number;
    packetsPerSecond: number;
    bytesPerSecond: number;
    protocolDistribution: Record<string, number>;
    portDistribution: Record<number, number>;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const NetworkForensicsPage = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PcapAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [filterText, setFilterText] = useState("");
  const [selectedCase, setSelectedCase] = useState("none");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pcap") && !file.name.endsWith(".cap")) {
      toast({ title: "Formato inválido", description: "Envie um arquivo .pcap ou .cap", variant: "destructive" });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite: 100MB", variant: "destructive" });
      return;
    }

    setLoading(true);
    setFileName(file.name);
    setAnalysis(null);

    await logAudit("pcap_upload", "rede", { fileName: file.name, fileSize: file.size });

    try {
      // Read as base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pcap`;
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
      toast({ title: "Análise concluída", description: `${data.fileInfo.packetCount} pacotes analisados` });
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
    const iocSummary = [
      `IPs Origem: ${analysis.iocs.uniqueSrcIps.length}`,
      `IPs Destino: ${analysis.iocs.uniqueDstIps.length}`,
      `Portas: ${analysis.iocs.uniquePorts.length}`,
      `Protocolos: ${Object.keys(analysis.iocs.protocols).join(", ")}`,
      `Pacotes: ${analysis.fileInfo.packetCount}`,
      `Duração: ${formatDuration(analysis.fileInfo.duration)}`,
      analysis.iocs.suspiciousFindings.length > 0
        ? `\nALERTAS:\n${analysis.iocs.suspiciousFindings.join("\n")}`
        : "",
    ].join("\n");

    await saveEvidence({
      module: "rede",
      title: `Forense de Rede — ${fileName}`,
      inputContent: `Arquivo: ${fileName}\nTamanho: ${formatBytes(analysis.fileInfo.fileSize)}\nPeríodo: ${new Date(analysis.fileInfo.startTime).toLocaleString("pt-BR")} a ${new Date(analysis.fileInfo.endTime).toLocaleString("pt-BR")}`,
      resultContent: iocSummary,
      caseId: selectedCase !== "none" ? selectedCase : undefined,
      metadata: {
        pcapFileName: fileName,
        pcapFileSize: analysis.fileInfo.fileSize,
        packetCount: analysis.fileInfo.packetCount,
        topTalkers: analysis.iocs.topTalkers.slice(0, 10),
        suspiciousFindings: analysis.iocs.suspiciousFindings,
        connections: analysis.iocs.connections.slice(0, 20),
      },
    });
    setSaving(false);
    toast({ title: "Evidência salva na cadeia de custódia!" });
  };

  const handleCopyIOCs = () => {
    if (!analysis) return;
    const text = [
      "=== IOCs Extraídos ===",
      `\nIPs Origem (${analysis.iocs.uniqueSrcIps.length}):`,
      ...analysis.iocs.uniqueSrcIps,
      `\nIPs Destino (${analysis.iocs.uniqueDstIps.length}):`,
      ...analysis.iocs.uniqueDstIps,
      `\nPortas (${analysis.iocs.uniquePorts.length}):`,
      analysis.iocs.uniquePorts.join(", "),
      `\nDNS Queries (${analysis.iocs.dnsQueries.length}):`,
      ...analysis.iocs.dnsQueries.map(q => q.name),
      analysis.iocs.suspiciousFindings.length > 0 ? `\nAlertas:` : "",
      ...analysis.iocs.suspiciousFindings,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredPackets = analysis?.packets.filter((pkt) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      pkt.srcIp.includes(q) || pkt.dstIp.includes(q) ||
      pkt.protocol.toLowerCase().includes(q) ||
      String(pkt.srcPort).includes(q) || String(pkt.dstPort).includes(q) ||
      (pkt.info || "").toLowerCase().includes(q)
    );
  }) || [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Network className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Forense de Redes</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Análise forense de tráfego de rede — upload de arquivos .pcap para extração de IOCs, análise de protocolos e detecção de anomalias.
      </p>

      {/* Upload */}
      <div className="glass-card rounded-xl p-5 mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Upload de Captura de Rede</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie arquivos <code className="text-primary">.pcap</code> gerados pelo Wireshark, tcpdump ou tshark (até 100MB).
          O parser extrai automaticamente IPs, portas, protocolos, consultas DNS e indicadores de comprometimento (IOCs).
        </p>
        <input ref={fileRef} type="file" accept=".pcap,.cap" onChange={handleUpload} className="hidden" />
        <div className="flex gap-3 items-end">
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Analisando..." : "Selecionar arquivo .pcap"}
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Activity, label: "Pacotes", value: analysis.fileInfo.packetCount.toLocaleString() },
              { icon: Server, label: "IPs Únicos", value: `${analysis.iocs.uniqueSrcIps.length + analysis.iocs.uniqueDstIps.length}` },
              { icon: Wifi, label: "Protocolos", value: Object.keys(analysis.iocs.protocols).length.toString() },
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

          {/* File Info */}
          <div className="glass-card rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Período:</span><p className="text-foreground">{new Date(analysis.fileInfo.startTime).toLocaleString("pt-BR")} — {new Date(analysis.fileInfo.endTime).toLocaleString("pt-BR")}</p></div>
              <div><span className="text-muted-foreground">Duração:</span><p className="text-foreground">{formatDuration(analysis.fileInfo.duration)}</p></div>
              <div><span className="text-muted-foreground">Tamanho:</span><p className="text-foreground">{formatBytes(analysis.fileInfo.fileSize)}</p></div>
              <div><span className="text-muted-foreground">Taxa:</span><p className="text-foreground">{analysis.statistics.packetsPerSecond} pkt/s | {formatBytes(analysis.statistics.bytesPerSecond)}/s</p></div>
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
              <TabsTrigger value="packets">Pacotes</TabsTrigger>
              <TabsTrigger value="connections">Conexões</TabsTrigger>
              <TabsTrigger value="dns">DNS</TabsTrigger>
              <TabsTrigger value="alerts">Alertas</TabsTrigger>
            </TabsList>

            {/* IOCs Tab */}
            <TabsContent value="iocs" className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Top Talkers */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-primary" /> Top Talkers (Origem)
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {analysis.iocs.topTalkers.map((t, i) => (
                      <div key={t.ip} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4">{i + 1}.</span>
                          <code className="text-foreground font-mono">{t.ip}</code>
                        </div>
                        <div className="flex gap-3 text-muted-foreground">
                          <span>{t.packets} pkts</span>
                          <span>{formatBytes(t.bytes)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Protocols */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Distribuição de Protocolos
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(analysis.iocs.protocols)
                      .sort(([, a], [, b]) => b - a)
                      .map(([proto, count]) => {
                        const pct = (count / analysis.fileInfo.packetCount) * 100;
                        return (
                          <div key={proto} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-foreground font-mono">{proto}</span>
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

                {/* Top Ports */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Portas mais acessadas
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {Object.entries(analysis.statistics.portDistribution)
                      .slice(0, 15)
                      .map(([port, count]) => (
                        <div key={port} className="flex justify-between text-xs py-1 border-b border-border/20 last:border-0">
                          <code className="text-foreground font-mono">{port}</code>
                          <span className="text-muted-foreground">{count} pacotes</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Unique IPs */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" /> IPs Únicos ({analysis.iocs.uniqueSrcIps.length} origem / {analysis.iocs.uniqueDstIps.length} destino)
                  </h4>
                  <div className="max-h-60 overflow-auto space-y-0.5 font-mono text-[10px]">
                    {analysis.iocs.uniqueSrcIps.slice(0, 50).map((ip) => (
                      <div key={`s-${ip}`} className="flex items-center gap-2 text-foreground/80">
                        <Badge variant="outline" className="text-[8px] h-4 px-1 bg-primary/10 text-primary border-primary/30">SRC</Badge>
                        {ip}
                      </div>
                    ))}
                    {analysis.iocs.uniqueDstIps.slice(0, 50).map((ip) => (
                      <div key={`d-${ip}`} className="flex items-center gap-2 text-foreground/80">
                        <Badge variant="outline" className="text-[8px] h-4 px-1 bg-muted text-muted-foreground">DST</Badge>
                        {ip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Packets Tab */}
            <TabsContent value="packets">
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-3 border-b border-border/50 flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por IP, porta, protocolo..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="h-7 bg-transparent border-0 text-sm focus-visible:ring-0 p-0"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{filteredPackets.length} pacotes</span>
                </div>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border/50">
                        <th className="text-left p-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">IP Origem</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Porta</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">IP Destino</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Porta</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Proto</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Tam</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPackets.slice(0, 200).map((pkt, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-mono text-foreground">{pkt.srcIp}</td>
                          <td className="p-2 font-mono text-foreground">{pkt.srcPort || "—"}</td>
                          <td className="p-2 font-mono text-foreground">{pkt.dstIp}</td>
                          <td className="p-2 font-mono text-foreground">{pkt.dstPort || "—"}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">{pkt.protocol}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">{pkt.length}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[200px]">{pkt.info || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections">
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border/50">
                        <th className="text-left p-2 text-muted-foreground font-medium">Origem</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Destino</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Porta</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Protocolo</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Pacotes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.iocs.connections.map((conn, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="p-2 font-mono text-foreground">{conn.src}</td>
                          <td className="p-2 font-mono text-foreground">{conn.dst}</td>
                          <td className="p-2 font-mono text-foreground">{conn.port || "—"}</td>
                          <td className="p-2"><Badge variant="outline" className="text-[9px] h-4 px-1.5">{conn.protocol}</Badge></td>
                          <td className="p-2 text-foreground font-semibold">{conn.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* DNS Tab */}
            <TabsContent value="dns">
              <div className="glass-card rounded-xl overflow-hidden">
                {analysis.iocs.dnsQueries.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma consulta DNS encontrada.</div>
                ) : (
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border/50">
                          <th className="text-left p-2 text-muted-foreground font-medium">#</th>
                          <th className="text-left p-2 text-muted-foreground font-medium">Domínio</th>
                          <th className="text-left p-2 text-muted-foreground font-medium">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.iocs.dnsQueries.map((q, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2 font-mono text-foreground">{q.name}</td>
                            <td className="p-2 text-muted-foreground">{q.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts">
              <div className="glass-card rounded-xl p-5 space-y-3">
                {analysis.iocs.suspiciousFindings.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-green-400/5 border border-green-400/20 rounded-lg">
                    <Shield className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Nenhuma anomalia detectada</p>
                      <p className="text-xs text-muted-foreground">A análise automatizada não encontrou indicadores suspeitos nesta captura.</p>
                    </div>
                  </div>
                ) : (
                  analysis.iocs.suspiciousFindings.map((finding, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{finding}</p>
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

export default NetworkForensicsPage;
