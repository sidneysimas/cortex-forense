import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { Globe, Download, KeyRound, Mail, Phone, Cookie, Bookmark, Search } from "lucide-react";
import type { ChromeReport } from "@/lib/chrome-parsers";
import ActivityHeatmap from "./ActivityHeatmap";

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 text-white/50 text-[11px] uppercase tracking-wider font-semibold">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-bold mt-2">{value}</div>
      {hint && <div className="text-[10px] text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

export default function ChromeDashboard({ report }: { report: ChromeReport }) {
  const h = report.history;
  const l = report.logins;
  const w = report.webData;
  const c = report.cookies;
  const b = report.bookmarks;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {h && <Kpi icon={Globe} label="URLs únicas" value={h.totalUrls.toLocaleString("pt-BR")} hint={`${h.totalVisits.toLocaleString("pt-BR")} visitas totais`} />}
        {h && <Kpi icon={Search} label="Domínios distintos" value={h.topDomains.length} hint={h.periodStart && h.periodEnd ? `${h.periodStart.toLocaleDateString("pt-BR")} → ${h.periodEnd.toLocaleDateString("pt-BR")}` : "—"} />}
        {h && <Kpi icon={Download} label="Downloads" value={h.downloads.length} />}
        {l && <Kpi icon={KeyRound} label="Credenciais salvas" value={l.total} hint={`${l.uniqueDomains} domínios`} />}
        {w && <Kpi icon={Mail} label="Emails identificados" value={w.emails.length} />}
        {w && <Kpi icon={Phone} label="Telefones identificados" value={w.phones.length} />}
        {c && <Kpi icon={Cookie} label="Cookies" value={c.total.toLocaleString("pt-BR")} hint={`P:${c.persistentCount} · S:${c.sessionCount}`} />}
        {b && <Kpi icon={Bookmark} label="Favoritos" value={b.total} hint={`${b.folders} pastas`} />}
      </div>

      {h && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-white/80 mb-4">Mapa de atividade (dia × hora)</h3>
          <ActivityHeatmap matrix={h.activityMatrix} />
        </div>
      )}

      {h && h.topDomains.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-white/80 mb-4">Top 15 domínios (por visitas)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={h.topDomains.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} />
              <YAxis type="category" dataKey="host" stroke="rgba(255,255,255,0.6)" fontSize={10} width={160} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "rgba(16,185,129,0.05)" }}
              />
              <Bar dataKey="visits" fill="rgb(16,185,129)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {h && h.timeline.length > 1 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-white/80 mb-4">Atividade diária</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={h.timeline}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} tick={{ fontSize: 9 }} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="visits" stroke="rgb(16,185,129)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(w?.emails.length || w?.phones.length || w?.addresses.length) ? (
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-white/80 mb-4">PII extraída (Autofill)</h3>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            {w!.emails.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Emails ({w!.emails.length})</div>
                <ul className="space-y-1 max-h-48 overflow-y-auto pr-2">
                  {w!.emails.map((e) => <li key={e} className="text-white/80 font-mono text-[11px]">{e}</li>)}
                </ul>
              </div>
            )}
            {w!.phones.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Telefones ({w!.phones.length})</div>
                <ul className="space-y-1 max-h-48 overflow-y-auto pr-2">
                  {w!.phones.map((p) => <li key={p} className="text-white/80 font-mono text-[11px]">{p}</li>)}
                </ul>
              </div>
            )}
            {w!.addresses.length > 0 && (
              <div className="md:col-span-2">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Endereços ({w!.addresses.length})</div>
                <ul className="space-y-1 max-h-48 overflow-y-auto pr-2">
                  {w!.addresses.map((a, i) => (
                    <li key={i} className="text-white/80 text-[11px]">
                      <span className="font-medium">{a.fullName || "—"}</span> · {a.address}, {a.city} · CEP {a.zip} · {a.country}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {l && l.logins.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display text-sm font-bold text-white/80 mb-4">
            Credenciais salvas (senhas cifradas pelo SO)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/40 border-b border-white/5">
                  <th className="py-2 font-medium">Origem</th>
                  <th className="py-2 font-medium">Usuário</th>
                  <th className="py-2 font-medium text-right">Usos</th>
                  <th className="py-2 font-medium">Último uso</th>
                </tr>
              </thead>
              <tbody>
                {l.logins.slice(0, 30).map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 font-mono text-[11px] truncate max-w-xs">{row.origin}</td>
                    <td className="py-2 text-white/80">{row.username || "—"}</td>
                    <td className="py-2 text-right text-white/60">{row.timesUsed}</td>
                    <td className="py-2 text-white/50 text-[11px]">{row.lastUsed?.toLocaleString("pt-BR") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {l.logins.length > 30 && (
              <p className="text-[10px] text-white/40 mt-2">Mostrando 30 de {l.logins.total ?? l.logins.length}. O parecer da IA considera todo o conjunto.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
