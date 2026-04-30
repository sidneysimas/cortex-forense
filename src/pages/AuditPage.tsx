import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Shield } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  module: string;
  details: Record<string, unknown>;
  created_at: string;
}

const AuditPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setLogs((data as AuditLog[]) || []);
        setLoading(false);
      });
  }, [user]);

  const actionLabels: Record<string, string> = {
    login: "Login realizado",
    analysis_started: "Análise iniciada",
    evidence_saved: "Evidência salva",
    profile_updated: "Perfil atualizado",
    web_capture: "Captura web realizada",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Log de Auditoria</h1>
      </div>
      <p className="text-muted-foreground mb-6">Registro de todas as ações realizadas na plataforma.</p>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 text-muted-foreground font-medium">Data/Hora</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Ação</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Módulo</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="p-3 text-foreground/80 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-foreground">
                    {actionLabels[log.action] || log.action}
                  </td>
                  <td className="p-3 text-muted-foreground capitalize">{log.module || "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">
                    {Object.keys(log.details || {}).length > 0
                      ? JSON.stringify(log.details)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditPage;
