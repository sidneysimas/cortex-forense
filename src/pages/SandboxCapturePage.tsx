import { useState, useRef } from "react";
import { Globe, Shield, Loader2, AlertTriangle, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { saveEvidence } from "@/lib/audit";
import CaseSelector from "@/components/dashboard/CaseSelector";

const SandboxCapturePage = () => {
  const [url, setUrl] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [selectedCase, setSelectedCase] = useState("none");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleNavigate = () => {
    if (!url.trim()) return;
    let fullUrl = url.trim();
    if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
      fullUrl = "https://" + fullUrl;
    }
    setIframeUrl(fullUrl);
    setLoading(true);
  };

  const handleCapture = async () => {
    if (!iframeUrl) {
      toast({ title: "Navegue até uma página primeiro", variant: "destructive" });
      return;
    }
    setCapturing(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-capture", {
        body: { url: iframeUrl },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      await saveEvidence({
        module: "web-capture",
        title: `Sandbox: ${data.title || iframeUrl}`,
        inputContent: iframeUrl,
        resultContent: data.aiAnalysis || data.textPreview,
        fileHash: data.contentHash,
        metadata: {
          captureId: data.captureId,
          captureMode: "sandbox-isolated",
          finalUrl: data.finalUrl,
          statusCode: data.statusCode,
          serverIp: data.serverIp,
          dnsRecords: data.dnsRecords,
          whoisData: data.whoisData,
          sslInfo: data.sslInfo,
          responseHeaders: data.responseHeaders,
          screenshotBase64: data.screenshotBase64,
        },
        caseId: selectedCase !== "none" ? selectedCase : undefined,
      });
      toast({ title: "Captura sandbox salva", description: "Evidência registrada com modo isolado." });
    } catch (err: any) {
      toast({ title: "Erro na captura", description: err.message, variant: "destructive" });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3 mb-1">
        <Lock className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Navegação Isolada (Sandbox)</h1>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Ambiente isolado para navegação e captura antifraude. O conteúdo é carregado em iframe sandboxed.
      </p>

      <div className="glass-card rounded-xl p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite a URL para navegar (ex: https://exemplo.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
              className="pl-10 bg-muted/30 border-border/60"
            />
          </div>
          <Button onClick={handleNavigate} variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" /> Navegar
          </Button>
          <Button onClick={handleCapture} disabled={capturing || !iframeUrl} className="gap-2">
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Capturar
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <CaseSelector value={selectedCase} onChange={setSelectedCase} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 px-1">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs text-muted-foreground">
          Sandbox isolado: scripts bloqueados, navegação restrita, sem acesso a cookies ou storage do navegador.
        </span>
      </div>

      <div className="flex-1 glass-card rounded-xl overflow-hidden border-2 border-primary/20 min-h-[400px]">
        {iframeUrl ? (
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            className="w-full h-full bg-white"
            onLoad={() => setLoading(false)}
            title="Sandbox Browser"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Digite uma URL e clique em "Navegar" para iniciar</p>
              <p className="text-xs mt-1 opacity-60">O conteúdo será exibido em ambiente isolado</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SandboxCapturePage;
