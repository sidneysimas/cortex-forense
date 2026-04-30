import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, Users, Search, AlertTriangle, TrendingUp, Zap, MapPin } from "lucide-react";

export const ForensicDashboard = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            Painel de <span className="text-primary">Controle</span>
          </h2>
          <p className="text-muted-foreground text-sm font-medium">Status operacional do sistema e inteligência em tempo real.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
            <Zap className="w-3 h-3 fill-current" />
            Sistemas Nominais
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Investigações Ativas", val: "142", icon: <Shield />, color: "text-primary" },
          { label: "Alertas de Risco", val: "08", icon: <AlertTriangle />, color: "text-red-500" },
          { label: "Entidades Mapeadas", val: "1.2k", icon: <Users />, color: "text-secondary" },
          { label: "Consultas OSINT/24h", val: "856", icon: <Search />, color: "text-blue-400" }
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 border-white/5 overflow-hidden group hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded bg-white/5 ${stat.color}`}>{stat.icon}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Ativo</div>
              </div>
              <div className="text-3xl font-black mb-1">{stat.val}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Volume de Dados Processados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full flex items-end gap-1.5 px-2">
              {[40, 70, 45, 90, 65, 80, 50, 85, 95, 60, 75, 55].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm relative group" 
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {h}%
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 px-2">
               {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                 <span key={m} className="text-[10px] text-muted-foreground font-bold">{m}</span>
               ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Atividade Geográfica Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { city: "São Paulo, SP", time: "2 min atrás", action: "Consulta CPF" },
                { city: "Brasília, DF", time: "15 min atrás", action: "Dossiê Político" },
                { city: "Rio de Janeiro, RJ", time: "42 min atrás", action: "Análise de Vínculos" },
                { city: "Curitiba, PR", time: "1h atrás", action: "Rastreio de Ativos" },
              ].map((loc, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <div>
                    <div className="text-xs font-bold text-foreground">{loc.city}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{loc.action}</div>
                  </div>
                  <div className="text-[10px] font-bold text-primary">{loc.time}</div>
                </div>
              ))}
              <Button variant="ghost" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest">
                Ver Mapa Global
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
