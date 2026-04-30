import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, type OrgMember } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, UserPlus, Crown, Shield, Eye, Trash2, Loader2, Copy, Mail,
} from "lucide-react";
import { logAudit } from "@/lib/audit";

const OrganizationPage = () => {
  const { user } = useAuth();
  const { currentOrg, currentRole, createOrg, refreshOrgs } = useOrganization();

  // Create org
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  // Members
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("perito");
  const [inviting, setInviting] = useState(false);

  // Pending invites
  const [invites, setInvites] = useState<any[]>([]);

  // Org settings
  const [orgName, setOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      loadMembers();
      loadInvites();
    }
  }, [currentOrg]);

  const loadMembers = async () => {
    if (!currentOrg) return;
    setLoadingMembers(true);
    const { data } = await supabase
      .from("org_members")
      .select("id, org_id, user_id, role, created_at")
      .eq("org_id", currentOrg.id);

    if (data) {
      // Fetch profile names
      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, area_of_expertise")
        .in("id", userIds);

      const enriched = data.map((m: any) => ({
        ...m,
        profiles: profiles?.find((p: any) => p.id === m.user_id) || { full_name: "—", area_of_expertise: null },
      }));
      setMembers(enriched);
    }
    setLoadingMembers(false);
  };

  const loadInvites = async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("org_invites")
      .select("*")
      .eq("org_id", currentOrg.id)
      .is("accepted_at", null);
    setInvites(data || []);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    const org = await createOrg(newOrgName.trim());
    if (org) {
      toast({ title: "Organização criada", description: `${org.name} está pronta.` });
      await logAudit("org_created", "organizacao", { org_id: org.id, name: org.name });
      setNewOrgName("");
    } else {
      toast({ title: "Erro ao criar organização", variant: "destructive" });
    }
    setCreating(false);
  };

  const handleUpdateOrg = async () => {
    if (!currentOrg || !orgName.trim()) return;
    setSavingOrg(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName.trim(), updated_at: new Date().toISOString() })
      .eq("id", currentOrg.id);
    if (!error) {
      toast({ title: "Organização atualizada" });
      await refreshOrgs();
    }
    setSavingOrg(false);
  };

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return;
    setInviting(true);
    const { error } = await supabase
      .from("org_invites")
      .insert({
        org_id: currentOrg.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole as any,
        invited_by: user!.id,
      });
    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite enviado", description: `Convite para ${inviteEmail}` });
      await logAudit("member_invited", "organizacao", { email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      loadInvites();
    }
    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast({ title: "Você não pode se remover", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (!error) {
      toast({ title: "Membro removido" });
      loadMembers();
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("org_members")
      .update({ role: newRole as any })
      .eq("id", memberId);
    if (!error) {
      toast({ title: "Papel atualizado" });
      loadMembers();
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    await supabase.from("org_invites").delete().eq("id", inviteId);
    loadInvites();
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Crown className="h-4 w-4 text-primary" />;
    if (role === "perito") return <Shield className="h-4 w-4 text-blue-400" />;
    return <Eye className="h-4 w-4 text-muted-foreground" />;
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Administrador";
    if (role === "perito") return "Perito";
    return "Assistente";
  };

  const isAdmin = currentRole === "admin";

  if (!currentOrg) {
    return (
      <div className="space-y-6 max-w-lg">
        <h1 className="text-2xl font-display font-bold">Criar Organização</h1>
        <p className="text-muted-foreground">Crie sua organização para começar a usar o Cortex Forense com sua equipe.</p>
        <div className="flex gap-2">
          <Input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Nome da organização"
            onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
          />
          <Button onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Criar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          {currentOrg.name}
        </h1>
        <p className="text-muted-foreground text-sm">Gerencie membros e configurações da organização</p>
      </div>

      {/* Org Settings */}
      {isAdmin && (
        <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
          <h2 className="font-semibold">Configurações</h2>
          <div className="flex gap-2">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nome" />
            <Button onClick={handleUpdateOrg} disabled={savingOrg}>
              {savingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Slug: {currentOrg.slug}</p>
        </div>
      )}

      {/* Invite */}
      {isAdmin && (
        <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><UserPlus className="h-5 w-5" /> Convidar Membro</h2>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
              className="flex-1 min-w-[200px]"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="perito">Perito</SelectItem>
                <SelectItem value="assistente">Assistente</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Convidar
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground font-medium">Convites Pendentes</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between bg-secondary/30 rounded px-3 py-2 text-sm">
                  <span>{inv.email} — {roleLabel(inv.role)}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteInvite(inv.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
        <h2 className="font-semibold">Membros ({members.length})</h2>
        {loadingMembers ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-secondary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  {roleIcon(m.role)}
                  <div>
                    <p className="font-medium text-sm">{m.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.profiles?.area_of_expertise || roleLabel(m.role)}</p>
                  </div>
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="perito">Perito</SelectItem>
                        <SelectItem value="assistente">Assistente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(m.id, m.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
                {m.user_id === user?.id && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">Você</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new org */}
      <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
        <h2 className="font-semibold">Criar Nova Organização</h2>
        <div className="flex gap-2">
          <Input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Nome da nova organização"
            onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
          />
          <Button onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationPage;
