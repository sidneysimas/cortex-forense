import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Fingerprint, HardDrive, FileSearch, FileText, Code2, Mail, Globe,
  Camera, FileQuestion, BarChart3, ShieldCheck, Clock, TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const modules = [
  { icon: Fingerprint, title: "Grafotecnia", desc: "Análise de assinaturas e comparação grafotécnica com IA", path: "/dashboard/grafotecnia", key: "grafotecnia" },
  { icon: HardDrive, title: "Leitura de Hives", desc: "Análise forense de registros do Windows", path: "/dashboard/hives", key: "hives" },
  { icon: FileSearch, title: "Análise Documental", desc: "Extração inteligente de dados e pontos controvertidos", path: "/dashboard/documental", key: "documental" },
  { icon: FileText, title: "Geração de Laudos", desc: "Laudos técnicos estruturados para tribunal", path: "/dashboard/laudos", key: "laudo" },
  { icon: Code2, title: "Plágio de Código", desc: "Comparação e análise de similaridade entre códigos", path: "/dashboard/plagio-codigo", key: "plagio-codigo" },
  { icon: Mail, title: "Análise de E-mails", desc: "E-mails, cabeçalhos, metadados e detecção de manipulação", path: "/dashboard/email-pst", key: "email-pst" },
  { icon: Globe, title: "Captura Web", desc: "Preserve provas digitais com hash de integridade", path: "/dashboard/web-capture", key: "web-capture" },
  { icon: Camera, title: "Análise de Imagens", desc: "Fotos periciais com descrição técnica por IA", path: "/dashboard/analise-imagem", key: "analise-imagem" },
  { icon: FileQuestion, title: "Quesitos", desc: "Extração, resposta e contestação de quesitos", path: "/dashboard/quesitos", key: "quesitos" },
];

const DashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, certified: 0, thisMonth: 0 });
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const [recentEvidences, setRecentEvidences] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("evidences")
      .select("id, module, created_at, tsa_timestamp, blockchain_tx, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const certified = data.filter((e: any) => e.tsa_timestamp || e.blockchain_tx).length;
        const thisMonth = data.filter((e: any) => new Date(e.created_at) >= monthStart).length;
        setStats({ total: data.length, certified, thisMonth });

        const counts: Record<string, number> = {};
        data.forEach((e: any) => { counts[e.module] = (counts[e.module] || 0) + 1; });
        setModuleCounts(counts);
        setRecentEvidences(data.slice(0, 5));
      });
  }, [user]);

  const chartData = modules
    .map((m) => ({ name: m.title.split(" ")[0], count: moduleCounts[m.key] || 0 }))
    .filter((d) => d.count > 0);

  const statCards = [
    { icon: BarChart3, label: "Total de Análises", value: stats.total, color: "text-primary" },
    { icon: ShieldCheck, label: "Certificadas", value: stats.certified, color: "text-green-400" },
    { icon: Clock, label: "Este Mês", value: stats.thisMonth, color: "text-blue-400" },
    { icon: TrendingUp, label: "Módulos Usados", value: Object.keys(moduleCounts).length, color: "text-amber-400" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Painel de Operações</h1>
      <p className="text-muted-foreground mb-6">Visão geral das atividades forenses.</p>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Recent */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {chartData.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-sm font-semibold text-foreground mb-4">Evidências por Módulo</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(30 90% ${50 + i * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="glass-card rounded-xl p-5">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">Últimas Evidências</h2>
          {recentEvidences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma evidência registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentEvidences.map((ev: any) => (
                <Link key={ev.id} to="/dashboard/evidencias" className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{ev.title || "Sem título"}</p>
                    <p className="text-xs text-muted-foreground">{ev.module} • {new Date(ev.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {(ev.tsa_timestamp || ev.blockchain_tx) && <ShieldCheck className="h-4 w-4 text-green-400 shrink-0" />}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module grid */}
      <h2 className="font-display text-lg font-semibold mb-4">Módulos Forenses</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            className="glass-card rounded-xl p-5 group transition-all hover:border-primary/30 hover:shadow-[0_0_30px_hsl(30_90%_50%/0.08)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/15 transition-colors">
                <m.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground">{m.title}</h3>
                  {moduleCounts[m.key] ? (
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{moduleCounts[m.key]}</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
