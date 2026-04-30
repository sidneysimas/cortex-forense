import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Lock, FileText, Clock, Hash, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SharedViewPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) { setError("Link inválido."); setLoading(false); return; }
    loadSharedData();
  }, [token]);

  const loadSharedData = async (pwd?: string) => {
    setLoading(true);
    try {
      const { data: link } = await supabase
        .from("shared_links")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (!link) { setError("Link expirado ou inválido."); setLoading(false); return; }
      if (new Date(link.expires_at) < new Date()) { setError("Este link expirou."); setLoading(false); return; }
      if (link.max_views > 0 && link.view_count >= link.max_views) { setError("Limite de visualizações atingido."); setLoading(false); return; }
      if (link.password_hash && !pwd) { setNeedsPassword(true); setLoading(false); return; }
      if (link.password_hash && pwd) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pwd));
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hashHex !== link.password_hash) { setError("Senha incorreta."); setLoading(false); return; }
      }

      let evidences: any[] = [];
      let caseData: any = null;

      if (link.case_id) {
        const { data: c } = await supabase.from("cases").select("*").eq("id", link.case_id).single();
        caseData = c;
        const { data: evs } = await supabase.from("evidences").select("*").eq("case_id", link.case_id).order("created_at", { ascending: false });
        evidences = evs || [];
      } else if (link.evidence_id) {
        const { data: ev } = await supabase.from("evidences").select("*").eq("id", link.evidence_id).single();
        if (ev) evidences = [ev];
      }

      setData({ link, caseData, evidences });
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card rounded-xl p-8 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  if (needsPassword) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card rounded-xl p-8 max-w-md w-full">
        <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold text-foreground mb-2 text-center">Link Protegido</h1>
        <p className="text-muted-foreground text-center mb-4 text-sm">Este conteúdo requer senha para acesso.</p>
        <div className="flex gap-2">
          <Input type="password" placeholder="Digite a senha" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadSharedData(password)} />
          <Button onClick={() => loadSharedData(password)}>Acessar</Button>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const moduleLabels: Record<string, string> = {
    grafotecnia: "Grafotecnia", hives: "Leitura de Hives", documental: "Análise Documental",
    laudo: "Geração de Laudos", "plagio-codigo": "Plágio de Código", "email-pst": "Análise de E-mails",
    "web-capture": "Captura Web", "analise-imagem": "Análise de Imagens", quesitos: "Quesitos",
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Cortex Forense — Compartilhamento Seguro</h1>
            <p className="text-xs text-muted-foreground">Acesso temporário • Expira em {new Date(data.link.expires_at).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {data.caseData && (
          <div className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-display text-lg font-semibold text-foreground">{data.caseData.title}</h2>
            {data.caseData.case_number && <p className="text-xs font-mono text-muted-foreground mt-1">{data.caseData.case_number}</p>}
            {data.caseData.court && <p className="text-sm text-muted-foreground mt-1">{data.caseData.court}</p>}
            {data.caseData.description && <p className="text-sm text-foreground/70 mt-2">{data.caseData.description}</p>}
          </div>
        )}

        <h2 className="font-display text-base font-semibold text-foreground mb-3">
          {data.evidences.length} Evidência{data.evidences.length !== 1 ? "s" : ""}
        </h2>

        <div className="space-y-4">
          {data.evidences.map((ev: any) => (
            <div key={ev.id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-foreground">{ev.title || "Sem título"}</h3>
                <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
                  {moduleLabels[ev.module] || ev.module}
                </span>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {ev.file_hash && (
                  <div className="flex items-start gap-2">
                    <Hash className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <code className="text-muted-foreground font-mono break-all">{ev.file_hash}</code>
                  </div>
                )}
                {(ev.tsa_timestamp || ev.blockchain_tx) && (
                  <div className="flex items-center gap-2 text-green-400">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Certificado (TSA + Blockchain)</span>
                  </div>
                )}
              </div>
              {ev.result_content && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Resultado:</p>
                  <pre className="text-xs bg-muted/30 rounded p-3 whitespace-pre-wrap max-h-40 overflow-auto text-foreground/80">{ev.result_content}</pre>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Gerado por <strong className="text-foreground">Cortex Forense</strong></p>
          <p>Verificação: <a href={`/verificar`} className="text-primary hover:underline">cortexforense.com/verificar</a></p>
        </div>
      </div>
    </div>
  );
};

export default SharedViewPage;
