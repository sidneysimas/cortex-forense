import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Shield, Search, Download, ChevronDown, ChevronRight,
  User as UserIcon, Monitor, MapPin, Clock, Activity, Filter, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  module: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: "Login realizado",
  logout: "Sessão encerrada",
  analysis_started: "Análise iniciada",
  analysis_completed: "Análise concluída",
  evidence_saved: "Evidência salva",
  evidence_viewed: "Evidência visualizada",
  evidence_exported: "Evidência exportada",
  evidence_certified: "Evidência certificada",
  evidence_modified: "Evidência alterada",
  evidence_shared: "Evidência compartilhada",
  profile_updated: "Perfil atualizado",
  web_capture: "Captura web realizada",
  ocr_saved: "OCR salvo",
  page_view: "Página acessada",
  case_created: "Caso criado",
  case_updated: "Caso atualizado",
  case_deleted: "Caso excluído",
  laudo_generated: "Laudo gerado",
  pdf_exported: "PDF exportado",
  zip_exported: "ZIP exportado",
  share_created: "Compartilhamento criado",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  logout: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  evidence_saved: "bg-primary/15 text-primary border-primary/30",
  evidence_certified: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  evidence_exported: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  evidence_modified: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  evidence_shared: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  analysis_started: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  analysis_completed: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  page_view: "bg-white/5 text-white/50 border-white/10",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function actionColor(action: string) {
  return ACTION_COLORS[action] || "bg-white/5 text-white/60 border-white/10";
}

function formatBRT(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }) + " BRT";
}

function detectBrowser(ua: string | undefined) {
  if (!ua) return "—";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Navegador";
}

function detectOS(ua: string | undefined) {
  if (!ua) return "—";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Desconhecido";
}

const AuditPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data as AuditLog[]) || [];
    setLogs(rows);

    const ids = Array.from(new Set(rows.map((r) => r.user_id))).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const map: Record<string, { full_name: string | null }> = {};
      (profs || []).forEach((p: any) => { map[p.id] = { full_name: p.full_name }; });
      setProfiles(map);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Real-time refresh on local audit events
  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener("audit_log_realtime", handler);
    return () => window.removeEventListener("audit_log_realtime", handler);
  // eslint-disable-next-line
  }, [user]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.module).filter(Boolean))).sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (moduleFilter !== "all" && l.module !== moduleFilter) return false;
      if (!q) return true;
      const blob = `${l.action} ${l.module} ${JSON.stringify(l.details || {})}`.toLowerCase();
      return blob.includes(q);
    });
  }, [logs, search, actionFilter, moduleFilter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const header = ["Data/Hora (BRT)", "Agente", "Email", "Ação", "Módulo", "IP", "Navegador", "SO", "Detalhes"];
    const rows = filtered.map((l) => {
      const iso = l.details?.iso27037 || {};
      const dev = iso.device || iso.acquisition?.device || {};
      const email = iso.agent || iso.acquisition?.agent || "";
      const name = profiles[l.user_id]?.full_name || "";
      return [
        formatBRT(l.created_at),
        name || email || l.user_id,
        email,
        actionLabel(l.action),
        l.module || "",
        l.ip_address || "",
        detectBrowser(dev.userAgent),
        detectOS(dev.userAgent),
        JSON.stringify(l.details || {}).replace(/"/g, '""'),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Log de Auditoria</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Registro completo de todas as ações realizadas na plataforma — quem fez, o quê, quando, de onde e em qual dispositivo (ABNT NBR ISO/IEC 27037:2013).
      </p>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação, módulo, hash, IP, agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/30 border-border/60"
          />
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px] bg-muted/30 border-border/60">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>{actionLabel(a)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[180px] bg-muted/30 border-border/60">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="gap-1.5">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {logs.length} registros
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {logs.length === 0
            ? "Nenhuma ação registrada ainda."
            : "Nenhum registro corresponde aos filtros."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const iso = log.details?.iso27037 || {};
            const dev = iso.device || iso.acquisition?.device || {};
            const email = iso.agent || iso.acquisition?.agent || "—";
            const name = profiles[log.user_id]?.full_name || email;
            const isOpen = expanded.has(log.id);

            return (
              <div
                key={log.id}
                className="glass-card rounded-xl border border-border/40 overflow-hidden transition-colors hover:border-border"
              >
                <button
                  onClick={() => toggle(log.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`${actionColor(log.action)} text-xs font-medium`}>
                        {actionLabel(log.action)}
                      </Badge>
                      {log.module && (
                        <Badge variant="outline" className="text-xs capitalize bg-white/5 border-white/10 text-white/60">
                          {log.module}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatBRT(log.created_at)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-foreground/80">
                        <UserIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{name}</span>
                        {email !== name && <span className="text-muted-foreground">({email})</span>}
                      </span>
                      {log.ip_address && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {log.ip_address}
                        </span>
                      )}
                      {dev.userAgent && (
                        <span className="inline-flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5" />
                          {detectBrowser(dev.userAgent)} · {detectOS(dev.userAgent)}
                        </span>
                      )}
                      {dev.screenResolution && (
                        <span className="inline-flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5" />
                          {dev.screenResolution}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border/40 bg-black/30 p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <DetailField label="ID do registro" value={log.id} mono />
                      <DetailField label="ID do agente" value={log.user_id} mono />
                      <DetailField label="Ação (raw)" value={log.action} mono />
                      <DetailField label="Módulo" value={log.module || "—"} />
                      <DetailField label="Data/Hora UTC" value={new Date(log.created_at).toISOString()} mono />
                      <DetailField label="Data/Hora BRT" value={formatBRT(log.created_at)} />
                      <DetailField label="Endereço IP" value={log.ip_address || "—"} mono />
                      <DetailField label="Idioma" value={dev.language || "—"} />
                      <DetailField label="Plataforma" value={dev.platform || "—"} />
                      <DetailField label="Fuso horário" value={dev.timezone || "—"} />
                    </div>

                    {dev.userAgent && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">User-Agent</div>
                        <div className="text-xs font-mono text-foreground/80 bg-background/40 rounded-md p-2 break-all">
                          {dev.userAgent}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Detalhes completos (JSON)
                      </div>
                      <pre className="text-xs font-mono text-foreground/80 bg-background/40 rounded-md p-3 max-h-72 overflow-auto whitespace-pre-wrap break-all">
{JSON.stringify(log.details || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-foreground/90 ${mono ? "font-mono break-all" : ""}`}>{value}</div>
    </div>
  );
}

export default AuditPage;