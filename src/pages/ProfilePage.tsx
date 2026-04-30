import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck, Copy } from "lucide-react";
import { logAudit } from "@/lib/audit";

const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    registration_number: "",
    area_of_expertise: "",
    phone: "",
    address: "",
  });

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const [profileRes, mfaRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (profileRes.data) {
        setForm({
          full_name: profileRes.data.full_name || "",
          registration_number: profileRes.data.registration_number || "",
          area_of_expertise: profileRes.data.area_of_expertise || "",
          phone: profileRes.data.phone || "",
          address: profileRes.data.address || "",
        });
      }

      if (mfaRes.data) {
        const totpFactors = mfaRes.data.totp || [];
        const verified = totpFactors.find((f: any) => f.status === "verified");
        setMfaEnabled(!!verified);
        if (verified) setMfaFactorId(verified.id);
      }

      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso!" });
      await logAudit("profile_updated", "perfil");
    }
  };

  const handleEnrollMfa = async () => {
    setMfaEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Cortex Forense TOTP",
      });
      if (error) throw error;
      setMfaQr(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
    } catch (err: any) {
      toast({ title: "Erro ao configurar 2FA", description: err.message, variant: "destructive" });
    } finally {
      setMfaEnrolling(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || !mfaCode) return;
    setMfaVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (cErr) throw cErr;

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (vErr) throw vErr;

      setMfaEnabled(true);
      setMfaQr(null);
      setMfaSecret(null);
      setMfaCode("");
      toast({ title: "2FA ativado com sucesso!" });
      await logAudit("mfa_enabled", "perfil");
    } catch (err: any) {
      toast({ title: "Código inválido", description: err.message, variant: "destructive" });
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleUnenrollMfa = async () => {
    if (!mfaFactorId) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
      toast({ title: "2FA desativado" });
      await logAudit("mfa_disabled", "perfil");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const fields = [
    { key: "full_name", label: "Nome Completo", placeholder: "Dr. João da Silva" },
    { key: "registration_number", label: "Nº de Registro / Matrícula", placeholder: "CREA-SP 12345" },
    { key: "area_of_expertise", label: "Área de Atuação", placeholder: "Forense Computacional" },
    { key: "phone", label: "Telefone", placeholder: "(11) 99999-0000" },
    { key: "address", label: "Endereço Profissional", placeholder: "Rua Exemplo, 100 - São Paulo/SP" },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Perfil do Perito</h1>
      <p className="text-muted-foreground mb-6">Dados que aparecerão nos laudos e documentos periciais.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold">Dados Pessoais</h2>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{f.label}</label>
              <Input
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="bg-muted/30 border-border/60"
              />
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Perfil
          </Button>
        </div>

        {/* 2FA Section */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Autenticação em Dois Fatores (2FA)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Proteja sua conta com um segundo fator de autenticação via aplicativo (Google Authenticator, Authy, etc.)
          </p>

          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-green-400" />
                <span className="text-sm text-green-400 font-medium">2FA ativo</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleUnenrollMfa} className="text-destructive">
                Desativar 2FA
              </Button>
            </div>
          ) : mfaQr ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">1. Escaneie o QR Code com seu app autenticador:</p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={mfaQr} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
              {mfaSecret && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ou insira manualmente:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted/50 p-2 rounded flex-1 break-all">{mfaSecret}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(mfaSecret); toast({ title: "Copiado!" }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-foreground">2. Digite o código de 6 dígitos:</p>
                <div className="flex gap-2">
                  <Input
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="font-mono text-center text-lg tracking-widest max-w-40"
                    maxLength={6}
                  />
                  <Button onClick={handleVerifyMfa} disabled={mfaCode.length !== 6 || mfaVerifying}>
                    {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleEnrollMfa} disabled={mfaEnrolling} className="gap-2">
              {mfaEnrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Configurar 2FA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
