import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link2, Plus, Loader2, Trash2, Copy, Check, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ShareManagementPage = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    case_id: "none",
    password: "",
    expires_hours: "72",
    max_views: "0",
  });

  const fetchData = async () => {
    if (!user) return;
    const [linksRes, casesRes] = await Promise.all([
      supabase.from("shared_links").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("cases").select("id, title").eq("user_id", user.id),
    ]);
    setLinks((linksRes.data as any[]) || []);
    setCases((casesRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleCreate = async () => {
    if (!user || form.case_id === "none") {
      toast({ title: "Selecione um caso", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let passwordHash = null;
      if (form.password) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(form.password));
        passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      }
      const expiresAt = new Date(Date.now() + parseInt(form.expires_hours) * 3600000).toISOString();
      const { error } = await supabase.from("shared_links").insert({
        user_id: user.id,
        case_id: form.case_id,
        password_hash: passwordHash,
        expires_at: expiresAt,
        max_views: parseInt(form.max_views) || 0,
      });
      if (error) throw error;
      toast({ title: "Link criado" });
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Revogar este link?")) return;
    await supabase.from("shared_links").update({ is_active: false }).eq("id", id);
    toast({ title: "Link revogado" });
    fetchData();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/compartilhado?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const getCaseTitle = (id: string) => cases.find((c) => c.id === id)?.title || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Compartilhamento Seguro</h1>
        </div>
        <Button onClick={() => { setForm({ case_id: "none", password: "", expires_hours: "72", max_views: "0" }); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Link
        </Button>
      </div>
      <p className="text-muted-foreground mb-6">Links temporários com senha para advogados e juízes.</p>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : links.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhum link de compartilhamento criado.
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const expired = new Date(link.expires_at) < new Date();
            const maxed = link.max_views > 0 && link.view_count >= link.max_views;
            const active = link.is_active && !expired && !maxed;

            return (
              <div key={link.id} className={`glass-card rounded-xl p-4 ${!active ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{getCaseTitle(link.case_id)}</p>
                      {link.password_hash && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-muted/30"}`}>
                        {active ? "Ativo" : expired ? "Expirado" : maxed ? "Limite atingido" : "Revogado"}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Expira: {new Date(link.expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {link.view_count}{link.max_views > 0 ? `/${link.max_views}` : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {active && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(link.token)} className="h-7 px-2 text-primary">
                        {copied === link.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {link.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)} className="h-7 px-2 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">Novo Link de Compartilhamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Caso *</label>
              <Select value={form.case_id} onValueChange={(v) => setForm({ ...form, case_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Senha (opcional)</label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Deixe vazio para acesso sem senha" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Validade</label>
              <Select value={form.expires_hours} onValueChange={(v) => setForm({ ...form, expires_hours: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="72">3 dias</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                  <SelectItem value="720">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Limite de visualizações (0 = ilimitado)</label>
              <Input type="number" value={form.max_views} onChange={(e) => setForm({ ...form, max_views: e.target.value })} min="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShareManagementPage;
