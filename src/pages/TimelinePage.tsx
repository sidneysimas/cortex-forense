import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Clock, ShieldCheck, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const moduleLabels: Record<string, string> = {
  grafotecnia: "Grafotecnia",
  hives: "Leitura de Hives",
  documental: "Análise Documental",
  laudo: "Geração de Laudos",
  "plagio-codigo": "Plágio de Código",
  "email-pst": "Análise de E-mails",
  "web-capture": "Captura Web",
  "analise-imagem": "Análise de Imagens",
  quesitos: "Quesitos",
};

const moduleColors: Record<string, string> = {
  grafotecnia: "bg-violet-500",
  hives: "bg-blue-500",
  documental: "bg-amber-500",
  laudo: "bg-green-500",
  "plagio-codigo": "bg-red-500",
  "email-pst": "bg-cyan-500",
  "web-capture": "bg-orange-500",
  "analise-imagem": "bg-pink-500",
  quesitos: "bg-teal-500",
};

interface TimelineEvent {
  id: string;
  type: "evidence" | "case_created" | "case_updated";
  title: string;
  subtitle: string;
  date: string;
  module?: string;
  certified: boolean;
}

const TimelinePage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [filterCase, setFilterCase] = useState(searchParams.get("case") || "all");

  useEffect(() => {
    if (!user) return;
    supabase.from("cases").select("id, title").eq("user_id", user.id).then(({ data }) => {
      if (data) setCases(data as any[]);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchTimeline = async () => {
      setLoading(true);
      let query = supabase
        .from("evidences")
        .select("id, title, module, created_at, case_id, tsa_timestamp, blockchain_tx")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (filterCase !== "all") {
        query = query.eq("case_id", filterCase);
      }

      const { data: evidences } = await query;

      const timelineEvents: TimelineEvent[] = (evidences || []).map((ev: any) => ({
        id: ev.id,
        type: "evidence" as const,
        title: ev.title || moduleLabels[ev.module] || ev.module,
        subtitle: moduleLabels[ev.module] || ev.module,
        date: ev.created_at,
        module: ev.module,
        certified: !!(ev.tsa_timestamp || ev.blockchain_tx),
      }));

      setEvents(timelineEvents);
      setLoading(false);
    };
    fetchTimeline();
  }, [user, filterCase]);

  const groupedByDate = events.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    const dateKey = new Date(ev.date).toLocaleDateString("pt-BR");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(ev);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Timeline do Caso</h1>
      </div>
      <p className="text-muted-foreground mb-4">Linha do tempo interativa com todas as evidências.</p>

      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Filtrar por caso</span>
        </div>
        <Select value={filterCase} onValueChange={setFilterCase}>
          <SelectTrigger className="mt-2 bg-muted/30 border-border/60 h-9 text-sm max-w-xs">
            <SelectValue placeholder="Caso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os casos</SelectItem>
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhuma evidência encontrada.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border/50" />

          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([dateStr, dayEvents]) => (
              <div key={dateStr}>
                {/* Date marker */}
                <div className="relative flex items-center gap-4 mb-4">
                  <div className="z-10 h-12 w-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{dateStr.split("/")[0]}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{dateStr}</span>
                    <span className="text-xs text-muted-foreground ml-2">{dayEvents.length} evento{dayEvents.length > 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Events */}
                <div className="space-y-3 ml-14">
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className="glass-card rounded-lg p-4 relative">
                      {/* Connector dot */}
                      <div className={`absolute -left-[2.6rem] top-5 h-3 w-3 rounded-full ${moduleColors[ev.module || ""] || "bg-muted-foreground"}`} />

                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-sm text-foreground truncate">{ev.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{ev.subtitle}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {new Date(ev.date).toLocaleTimeString("pt-BR")}
                          </p>
                        </div>
                        {ev.certified && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full shrink-0">
                            <ShieldCheck className="h-3 w-3" /> Certificado
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePage;
