import { useState } from "react";
import {
  Globe, Loader2, Copy, Check, Shield, Clock, Hash,
  ExternalLink, FileText, AlertCircle, Server, Lock, MapPin, Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

interface CaptureResult {
  captureId: string;
  timestamp: string;
  originalUrl: string;
  finalUrl: string;
  statusCode: number;
  title: string;
  description: string;
  contentHash: string;
  contentLength: number;
  textPreview: string;
  responseHeaders: Record<string, string>;
  aiAnalysis: string;
  dnsRecords: string[];
  serverIp: string;
  whoisData: {
    registrar: string;
    creationDate: string;
    expirationDate: string;
    nameServers: string[];
  } | null;
  sslInfo: Record<string, string>;
  htmlSnapshot: string;
  metadata: {
    captureAgent: string;
    hashAlgorithm: string;
    captureMethod: string;
    dnsLookup: boolean;
    whoisLookup: boolean;
    sslCheck: boolean;
    screenshotCaptured: boolean;
  };
  screenshotBase64: string | null;
}

const WebCapturePage = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");

  const handleCapture = async () => {
    if (!url.trim()) {
      toast({ title: "Atenção", description: "Informe a URL para captura.", variant: "destructive" });
      return;
    }

    let fullUrl = url.trim();
    if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
      fullUrl = "https://" + fullUrl;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("web-capture", {
        body: { url: fullUrl },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as CaptureResult);
      toast({ title: "Captura concluída", description: "Conteúdo web registrado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro na captura", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvidence = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveEvidence({
        module: "web-capture",
        title: `Captura: ${result.title}`,
        inputContent: result.originalUrl,
        resultContent: result.aiAnalysis || result.textPreview,
        fileHash: result.contentHash,
        metadata: {
          captureId: result.captureId,
          finalUrl: result.finalUrl,
          statusCode: result.statusCode,
          serverIp: result.serverIp,
          dnsRecords: result.dnsRecords,
          whoisData: result.whoisData,
          sslInfo: result.sslInfo,
          responseHeaders: result.responseHeaders,
        },
        caseId: selectedCase !== "none" ? selectedCase : undefined,
      });
      toast({ title: "Evidência salva", description: "Registrada na cadeia de custódia com hash de integridade." });
    } catch {
      toast({ title: "Erro", description: "Falha ao salvar evidência.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyReport = () => {
    if (!result) return;
    const report = `
═══════════════════════════════════════════════════
RELATÓRIO DE CAPTURA DE PROVA DIGITAL
Cortex Forense - Módulo de Captura Web v2.0
═══════════════════════════════════════════════════

ID DA CAPTURA: ${result.captureId}
DATA/HORA: ${new Date(result.timestamp).toLocaleString("pt-BR")}
AGENTE: ${result.metadata.captureAgent}

───────────────────────────────────────────────────
1. INFORMAÇÕES DA URL
───────────────────────────────────────────────────
URL Original: ${result.originalUrl}
URL Final: ${result.finalUrl}
Status HTTP: ${result.statusCode}
Título: ${result.title}
Descrição: ${result.description || "N/A"}

───────────────────────────────────────────────────
2. DADOS TÉCNICOS DO SERVIDOR
───────────────────────────────────────────────────
IP do Servidor: ${result.serverIp}
DNS Records: ${result.dnsRecords?.join(", ") || "N/A"}
SSL/TLS: ${result.sslInfo?.secure === "true" ? "Sim" : "Não"}
${result.whoisData ? `
Registrar: ${result.whoisData.registrar}
Data de Criação: ${result.whoisData.creationDate}
Data de Expiração: ${result.whoisData.expirationDate}
Name Servers: ${Array.isArray(result.whoisData.nameServers) ? result.whoisData.nameServers.join(", ") : "N/A"}` : ""}

───────────────────────────────────────────────────
3. INTEGRIDADE DO CONTEÚDO
───────────────────────────────────────────────────
Hash (${result.metadata.hashAlgorithm}): ${result.contentHash}
Tamanho: ${(result.contentLength / 1024).toFixed(1)} KB
Método: ${result.metadata.captureMethod}

───────────────────────────────────────────────────
4. CABEÇALHOS HTTP
───────────────────────────────────────────────────
${Object.entries(result.responseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}

───────────────────────────────────────────────────
5. ANÁLISE FORENSE (IA)
───────────────────────────────────────────────────
${result.aiAnalysis}

═══════════════════════════════════════════════════
FIM DO RELATÓRIO
Gerado por Cortex Forense em ${new Date().toLocaleString("pt-BR")}
═══════════════════════════════════════════════════
`.trim();

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Captura de Provas Web</h1>
      <p className="text-muted-foreground mb-6">
        Registre e preserve conteúdos da internet com metadados técnicos completos (DNS, WHOIS, SSL, headers).
      </p>

      <div className="glass-card rounded-xl p-5 mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cole a URL para captura (ex: https://exemplo.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCapture()}
              className="pl-10 bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={handleCapture} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {loading ? "Capturando..." : "Capturar"}
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <CaseSelector value={selectedCase} onChange={setSelectedCase} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Captura completa: conteúdo HTML, DNS, IP do servidor, WHOIS, certificado SSL, headers HTTP e análise IA.
        </p>
      </div>

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground font-medium">Capturando conteúdo...</p>
          <p className="text-sm text-muted-foreground mt-1">DNS, WHOIS, SSL, headers HTTP, conteúdo e análise IA</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Resultado da Captura</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSaveEvidence} disabled={saving} className="text-primary gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                {saving ? "Salvando..." : "Salvar na Cadeia de Custódia"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopyReport} className="text-muted-foreground hover:text-foreground gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar relatório"}
              </Button>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Data/Hora</span>
              </div>
              <p className="text-sm text-foreground font-mono">
                {new Date(result.timestamp).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Hash SHA-256</span>
              </div>
              <p className="text-xs text-foreground font-mono break-all">{result.contentHash}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">IP do Servidor</span>
              </div>
              <p className="text-sm text-foreground font-mono">{result.serverIp}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">SSL/TLS</span>
              </div>
              <p className="text-sm text-foreground">{result.sslInfo?.secure === "true" ? "✅ Seguro" : "⚠️ Não seguro"}</p>
            </div>
          </div>

          {/* URL & page info */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">Informações da Página</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0 w-24">URL Original:</span>
                <a href={result.originalUrl} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1 break-all">
                  {result.originalUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              {result.finalUrl !== result.originalUrl && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0 w-24">URL Final:</span>
                  <span className="text-foreground/80 break-all">{result.finalUrl}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 w-24">Título:</span>
                <span className="text-foreground/80">{result.title}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 w-24">Status HTTP:</span>
                <span className={`font-mono ${result.statusCode === 200 ? "text-green-400" : "text-yellow-400"}`}>{result.statusCode}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 w-24">DNS Records:</span>
                <span className="text-foreground/80 font-mono text-xs">{result.dnsRecords?.join(", ") || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* WHOIS */}
          {result.whoisData && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> WHOIS
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 w-32">Registrar:</span>
                  <span className="text-foreground/80">{result.whoisData.registrar}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 w-32">Data de Criação:</span>
                  <span className="text-foreground/80">{result.whoisData.creationDate}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 w-32">Data de Expiração:</span>
                  <span className="text-foreground/80">{result.whoisData.expirationDate}</span>
                </div>
              </div>
            </div>
          )}

          {/* Screenshot */}
          {result.screenshotBase64 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" /> Screenshot da Página
              </h3>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <img src={result.screenshotBase64} alt="Screenshot da página capturada" className="w-full" />
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {result.aiAnalysis && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Análise Forense (IA)
              </h3>
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{result.aiAnalysis}</div>
            </div>
          )}

          {/* Content preview */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">Conteúdo Textual Capturado</h3>
            <div className="max-h-[300px] overflow-auto rounded-lg bg-muted/30 border border-border/50 p-4">
              <p className="text-xs text-foreground/70 font-mono whitespace-pre-wrap leading-relaxed">{result.textPreview}</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Captura técnica completa:</strong> Este registro inclui IP do servidor,
              registros DNS, dados WHOIS, certificado SSL, cabeçalhos HTTP e hash SHA-256. Salve na cadeia de custódia
              e certifique com carimbo de tempo (TSA) e blockchain para máxima validade jurídica.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebCapturePage;
