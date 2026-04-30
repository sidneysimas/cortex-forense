import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldX, Loader2, Link2, Hash, Clock, Globe } from "lucide-react";
import cortexBrain from "@/assets/cortex-brain.png";

const VerifyPage = () => {
  const [params] = useSearchParams();
  const evidenceId = params.get("id");
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!evidenceId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    supabase
      .from("evidences")
      .select("id, module, title, file_hash, created_at, tsa_timestamp, tsa_token, blockchain_tx, blockchain_network, verification_url")
      .eq("id", evidenceId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEvidence(data);
        else setNotFound(true);
        setLoading(false);
      });
  }, [evidenceId]);

  const isCertified = evidence && (evidence.tsa_timestamp || evidence.blockchain_tx);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={cortexBrain} alt="Cortex" className="h-10 w-10" />
          <span className="font-display text-xl font-bold">Cortex <span className="glow-text">Forense</span></span>
        </div>

        <div className="glass-card rounded-2xl p-6 md:p-8">
          <h1 className="font-display text-xl font-bold text-center mb-6">Verificação de Evidência Digital</h1>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notFound ? (
            <div className="text-center space-y-3">
              <ShieldX className="h-16 w-16 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold text-destructive">Evidência não encontrada</h2>
              <p className="text-sm text-muted-foreground">
                O identificador fornecido não corresponde a nenhuma evidência registrada no sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status */}
              <div className={`flex items-center justify-center gap-3 p-4 rounded-xl ${isCertified ? "bg-green-400/5 border border-green-400/20" : "bg-amber-400/5 border border-amber-400/20"}`}>
                {isCertified ? (
                  <>
                    <ShieldCheck className="h-8 w-8 text-green-400" />
                    <div>
                      <p className="font-semibold text-green-400">Evidência Certificada</p>
                      <p className="text-xs text-muted-foreground">Integridade verificada com carimbo de tempo e blockchain</p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldX className="h-8 w-8 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-400">Certificação Pendente</p>
                      <p className="text-xs text-muted-foreground">Evidência registrada mas sem certificação TSA/blockchain</p>
                    </div>
                  </>
                )}
              </div>

              {/* Details */}
              <div className="space-y-3 text-sm">
                <InfoRow icon={<Globe className="h-4 w-4" />} label="Módulo" value={evidence.module} />
                <InfoRow icon={<Link2 className="h-4 w-4" />} label="Título" value={evidence.title || "—"} />
                <InfoRow icon={<Clock className="h-4 w-4" />} label="Data de Registro" value={new Date(evidence.created_at).toLocaleString("pt-BR")} />
                {evidence.file_hash && (
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Hash className="h-4 w-4" />
                      <span className="font-medium">Hash SHA-256</span>
                    </div>
                    <code className="block p-2 bg-muted/30 rounded text-xs font-mono break-all text-foreground/80">
                      {evidence.file_hash}
                    </code>
                  </div>
                )}
                {evidence.tsa_timestamp && (
                  <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Carimbo de Tempo (TSA)" value={evidence.tsa_timestamp} />
                )}
                {evidence.blockchain_tx && (
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="font-medium">Blockchain TX ({evidence.blockchain_network})</span>
                    </div>
                    <code className="block p-2 bg-muted/30 rounded text-xs font-mono break-all text-foreground/80">
                      {evidence.blockchain_tx}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Esta é uma página de verificação pública do Cortex Forense.<br />
          Os dados acima comprovam a existência e integridade da evidência digital.
        </p>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div>
      <span className="text-muted-foreground font-medium">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  </div>
);

export default VerifyPage;
