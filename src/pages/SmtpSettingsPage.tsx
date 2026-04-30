import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Loader2, Save, Send, Check, AlertCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SmtpSettingsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    from_email: "",
    from_name: "Cortex Forense",
    use_tls: true,
  });
  const [isVerified, setIsVerified] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("smtp_config").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("notification_queue").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([configRes, notifRes]) => {
      if (configRes.data) {
        const c = configRes.data as any;
        setForm({
          smtp_host: c.smtp_host,
          smtp_port: c.smtp_port,
          smtp_user: c.smtp_user,
          smtp_pass: c.smtp_pass,
          from_email: c.from_email,
          from_name: c.from_name,
          use_tls: c.use_tls,
        });
        setIsVerified(c.is_verified);
        setHasConfig(true);
      }
      setNotifications((notifRes.data as any[]) || []);
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.smtp_host || !form.smtp_user || !form.from_email) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (hasConfig) {
        const { error } = await supabase.from("smtp_config")
          .update({ ...form, is_verified: false, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("smtp_config")
          .insert({ ...form, user_id: user.id } as any);
        if (error) throw error;
        setHasConfig(true);
      }
      setIsVerified(false);
      toast({ title: "Configuração salva" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!user) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "test",
          recipientEmail: form.from_email,
          subject: "Teste SMTP — Cortex Forense",
          body: "Se você recebeu este e-mail, sua configuração SMTP está funcionando corretamente.",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      await supabase.from("smtp_config")
        .update({ is_verified: true, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      setIsVerified(true);
      toast({ title: "E-mail de teste enviado!", description: `Verifique ${form.from_email}` });
    } catch (err: any) {
      toast({ title: "Falha no teste", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-400/10",
    sent: "text-green-400 bg-green-400/10",
    failed: "text-red-400 bg-red-400/10",
  };

  const typeLabels: Record<string, string> = {
    test: "Teste",
    certification_complete: "Certificação",
    analysis_complete: "Análise Concluída",
    deadline_reminder: "Lembrete de Prazo",
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Configurações de E-mail</h1>
      </div>
      <p className="text-muted-foreground mb-6">Configure seu servidor SMTP para receber notificações automáticas.</p>

      <Tabs defaultValue="smtp">
        <TabsList className="mb-6">
          <TabsTrigger value="smtp">Configuração SMTP</TabsTrigger>
          <TabsTrigger value="history">Histórico de Envios</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <div className="glass-card rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">Servidor SMTP</h2>
              {isVerified && (
                <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                  <Check className="h-3 w-3" /> Verificado
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Host SMTP *</label>
                <Input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Porta *</label>
                <Input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Usuário SMTP *</label>
                <Input value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })} placeholder="seu@email.com" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Senha SMTP *</label>
                <Input type="password" value={form.smtp_pass} onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">E-mail de Envio *</label>
                <Input value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} placeholder="notificacoes@seudominio.com" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Nome do Remetente</label>
                <Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.use_tls} onCheckedChange={(v) => setForm({ ...form, use_tls: v })} />
              <span className="text-sm text-foreground">Usar TLS/STARTTLS</span>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Dica:</strong> Para Gmail, use <code className="bg-muted/50 px-1 rounded">smtp.gmail.com</code> porta 587
                com uma <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener" className="text-primary hover:underline">senha de app</a>.
                Para Outlook: <code className="bg-muted/50 px-1 rounded">smtp.office365.com</code> porta 587.
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configuração
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !hasConfig} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Teste
              </Button>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 mt-6">
            <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Notificações Automáticas
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Com o SMTP configurado, você receberá automaticamente:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Certificação concluída", desc: "Quando TSA/blockchain for aplicado a uma evidência" },
                { title: "Análise finalizada", desc: "Ao concluir qualquer análise forense" },
                { title: "Lembrete de prazo", desc: "Quando um prazo processual estiver próximo" },
                { title: "Compartilhamento acessado", desc: "Quando alguém acessar um link compartilhado" },
              ].map((n) => (
                <div key={n.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/30">
                  <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isVerified ? "text-green-400" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="glass-card rounded-xl overflow-hidden">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma notificação enviada ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Tipo</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Assunto</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id} className="border-b border-border/30">
                      <td className="p-3 text-foreground/80 whitespace-nowrap">{new Date(n.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3 text-foreground">{typeLabels[n.notification_type] || n.notification_type}</td>
                      <td className="p-3 text-foreground max-w-xs truncate">{n.subject}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[n.status] || ""}`}>
                          {n.status === "sent" ? "Enviado" : n.status === "failed" ? "Falhou" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmtpSettingsPage;
