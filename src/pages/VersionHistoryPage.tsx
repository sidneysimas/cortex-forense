import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { History, Loader2, GitCompare, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const VersionHistoryPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const evidenceId = searchParams.get("id");
  const [versions, setVersions] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diffView, setDiffView] = useState<{ v1: any; v2: any } | null>(null);

  useEffect(() => {
    if (!user || !evidenceId) return;
    Promise.all([
      supabase.from("evidences").select("*").eq("id", evidenceId).eq("user_id", user.id).single(),
      supabase.from("evidence_versions").select("*").eq("evidence_id", evidenceId).eq("user_id", user.id).order("version_number", { ascending: false }),
    ]).then(([evRes, verRes]) => {
      setEvidence(evRes.data);
      setVersions((verRes.data as any[]) || []);
      setLoading(false);
    });
  }, [user, evidenceId]);

  const computeDiff = (oldText: string, newText: string) => {
    const oldLines = (oldText || "").split("\n");
    const newLines = (newText || "").split("\n");
    const result: { type: "same" | "add" | "remove"; text: string }[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) result.push({ type: "add", text: newLines[i] });
      else if (i >= newLines.length) result.push({ type: "remove", text: oldLines[i] });
      else if (oldLines[i] !== newLines[i]) {
        result.push({ type: "remove", text: oldLines[i] });
        result.push({ type: "add", text: newLines[i] });
      } else result.push({ type: "same", text: oldLines[i] });
    }
    return result;
  };

  if (!evidenceId) return (
    <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
      Selecione uma evidência na cadeia de custódia para ver o histórico de versões.
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <History className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Histórico de Versões</h1>
      </div>
      {evidence && (
        <p className="text-muted-foreground mb-6">{evidence.title} — {versions.length} versão(ões)</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : versions.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhuma versão anterior registrada para esta evidência.
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v, i) => (
            <div key={v.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                    v{v.version_number}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.change_summary || "Versão registrada"}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(v.created_at).toLocaleString("pt-BR")}</span>
                      {v.file_hash && <span className="flex items-center gap-1 font-mono"><Hash className="h-3 w-3" /> {v.file_hash.slice(0, 12)}…</span>}
                    </div>
                  </div>
                </div>
                {i < versions.length - 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setDiffView({ v1: versions[i + 1], v2: v })} className="text-primary gap-1.5 h-7">
                    <GitCompare className="h-3.5 w-3.5" /> Comparar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!diffView} onOpenChange={() => setDiffView(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              Comparação: v{diffView?.v1.version_number} → v{diffView?.v2.version_number}
            </DialogTitle>
          </DialogHeader>
          {diffView && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Diferenças no resultado:</p>
                <div className="bg-muted/20 rounded-lg p-3 font-mono text-xs max-h-60 overflow-auto">
                  {computeDiff(diffView.v1.result_content, diffView.v2.result_content).map((line, i) => (
                    <div key={i} className={
                      line.type === "add" ? "text-green-400 bg-green-400/10" :
                      line.type === "remove" ? "text-red-400 bg-red-400/10 line-through" :
                      "text-foreground/60"
                    }>
                      {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}{line.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VersionHistoryPage;
