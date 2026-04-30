import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, TrendingUp, Calendar, ShieldCheck, Clock, Briefcase } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const moduleLabels: Record<string, string> = {
  grafotecnia: "Grafotecnia", hives: "Hives", documental: "Documental",
  laudo: "Laudos", "plagio-codigo": "Plágio", "email-pst": "E-mails",
  "web-capture": "Web", "analise-imagem": "Imagens", quesitos: "Quesitos",
};

const COLORS = [
  "hsl(30, 90%, 50%)", "hsl(200, 70%, 50%)", "hsl(150, 60%, 45%)",
  "hsl(280, 60%, 55%)", "hsl(350, 70%, 55%)", "hsl(45, 80%, 50%)",
  "hsl(170, 60%, 45%)", "hsl(220, 70%, 55%)", "hsl(0, 60%, 50%)",
];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState("30");
  const [evidences, setEvidences] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));

    Promise.all([
      supabase.from("evidences").select("*").eq("user_id", user.id).gte("created_at", since.toISOString()).order("created_at"),
      supabase.from("cases").select("*").eq("user_id", user.id),
    ]).then(([evRes, caseRes]) => {
      setEvidences(evRes.data || []);
      setCases(caseRes.data || []);
    });
  }, [user, period]);

  const certified = evidences.filter((e) => e.tsa_timestamp || e.blockchain_tx).length;
  const avgPerDay = period === "0" ? 0 : (evidences.length / parseInt(period)).toFixed(1);

  // Module distribution
  const moduleDist: Record<string, number> = {};
  evidences.forEach((e) => { moduleDist[e.module] = (moduleDist[e.module] || 0) + 1; });
  const pieData = Object.entries(moduleDist).map(([k, v]) => ({
    name: moduleLabels[k] || k, value: v,
  }));

  // Timeline (by day)
  const timelineMap: Record<string, number> = {};
  evidences.forEach((e) => {
    const day = new Date(e.created_at).toLocaleDateString("pt-BR");
    timelineMap[day] = (timelineMap[day] || 0) + 1;
  });
  const timelineData = Object.entries(timelineMap).map(([date, count]) => ({ date, count }));

  // Cases activity
  const caseActivity = cases.map((c) => ({
    name: c.title.length > 15 ? c.title.slice(0, 15) + "…" : c.title,
    evidences: evidences.filter((e) => e.case_id === c.id).length,
  })).filter((c) => c.evidences > 0).sort((a, b) => b.evidences - a.evidences).slice(0, 8);

  const stats = [
    { icon: BarChart3, label: "Total de Análises", value: evidences.length, color: "text-primary" },
    { icon: ShieldCheck, label: "Certificadas", value: certified, color: "text-green-400" },
    { icon: TrendingUp, label: "Média/Dia", value: avgPerDay, color: "text-blue-400" },
    { icon: Briefcase, label: "Casos Ativos", value: cases.filter((c) => c.status === "em_andamento").length, color: "text-amber-400" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Analytics Avançado</h1>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-muted-foreground mb-6">Métricas de produtividade e distribuição de análises forenses.</p>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
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

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Timeline */}
        {timelineData.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Evolução Temporal
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineData}>
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Line type="monotone" dataKey="count" stroke="hsl(30, 90%, 50%)" strokeWidth={2} dot={{ fill: "hsl(30, 90%, 50%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-display text-sm font-semibold text-foreground mb-4">Distribuição por Módulo</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cases activity */}
      {caseActivity.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Atividade por Caso
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={caseActivity} layout="vertical">
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="evidences" fill="hsl(30, 90%, 50%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {evidences.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhuma evidência no período selecionado.
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
