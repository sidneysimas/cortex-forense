import type { ChromeReport } from "./chrome-parsers";

// Builds a compact structured summary to send to the AI — never sends raw SQLite,
// never sends password/cookie values or full URL lists.
export function buildChromeAiSummary(r: ChromeReport): string {
  const lines: string[] = [];
  lines.push("# RELATÓRIO ESTRUTURADO — ARTEFATOS CHROME/CHROMIUM");
  lines.push("");
  lines.push("## Arquivos analisados");
  for (const f of r.files) {
    lines.push(`- ${f.name} (${f.kind}) — ${(f.size / 1024).toFixed(1)} KB — SHA-256: ${f.sha256}`);
  }

  if (r.history) {
    const h = r.history;
    lines.push("");
    lines.push("## Histórico de navegação");
    lines.push(`- URLs únicas: ${h.totalUrls}`);
    lines.push(`- Visitas totais: ${h.totalVisits}`);
    lines.push(`- Período coberto: ${h.periodStart?.toISOString() || "—"} → ${h.periodEnd?.toISOString() || "—"}`);
    lines.push(`- Downloads registrados: ${h.downloads.length}`);
    lines.push(`- Buscas armazenadas: ${h.searchTerms.length}`);
    lines.push("");
    lines.push("### Top 20 domínios (host — visitas — URLs distintas)");
    for (const d of h.topDomains) lines.push(`- ${d.host} — ${d.visits} — ${d.urls}`);
    lines.push("");
    lines.push("### Top 30 URLs mais visitadas");
    for (const u of h.topUrls.slice(0, 30)) {
      const t = (u.title || "").slice(0, 100);
      lines.push(`- [${u.visitCount}x] ${u.url} — "${t}"`);
    }
    if (h.searchTerms.length) {
      lines.push("");
      lines.push("### Amostras de termos de busca (até 30)");
      for (const s of h.searchTerms.slice(0, 30)) lines.push(`- ${s.term}`);
    }
    if (h.downloads.length) {
      lines.push("");
      lines.push("### Downloads (até 30)");
      for (const d of h.downloads.slice(0, 30)) {
        lines.push(`- ${d.startTime?.toISOString() || "—"} — ${d.target} — ${(d.totalBytes / 1024).toFixed(0)} KB — origem: ${d.url}`);
      }
    }
  }

  if (r.logins) {
    lines.push("");
    lines.push("## Credenciais salvas (Login Data)");
    lines.push(`- Total: ${r.logins.total}`);
    lines.push(`- Domínios distintos: ${r.logins.uniqueDomains}`);
    lines.push("- OBS: valores de senha permanecem cifrados pela DPAPI/Keychain do SO (não decodificáveis fora do host original).");
    lines.push("");
    lines.push("### Contas mais frequentes");
    for (const a of r.logins.topAccounts.slice(0, 20)) lines.push(`- ${a.username} (${a.count} ocorrência(s))`);
    lines.push("");
    lines.push("### Amostra de logins (até 30)");
    for (const l of r.logins.logins.slice(0, 30)) {
      lines.push(`- ${l.origin} — usuário: ${l.username || "—"} — usado ${l.timesUsed}x — último uso: ${l.lastUsed?.toISOString() || "—"}`);
    }
  }

  if (r.webData) {
    const w = r.webData;
    lines.push("");
    lines.push("## Autofill / dados pessoais (Web Data)");
    lines.push(`- Emails identificados: ${w.emails.length}`);
    lines.push(`- Telefones identificados: ${w.phones.length}`);
    lines.push(`- Endereços cadastrados: ${w.addresses.length}`);
    lines.push(`- Cartões (metadados apenas): ${w.creditCardsCount}`);
    if (w.emails.length) {
      lines.push("");
      lines.push("### Emails");
      for (const e of w.emails.slice(0, 30)) lines.push(`- ${e}`);
    }
    if (w.phones.length) {
      lines.push("");
      lines.push("### Telefones");
      for (const p of w.phones.slice(0, 30)) lines.push(`- ${p}`);
    }
    if (w.addresses.length) {
      lines.push("");
      lines.push("### Endereços");
      for (const a of w.addresses.slice(0, 20)) {
        lines.push(`- ${a.fullName} | ${a.email} | ${a.phone} | ${a.address}, ${a.city} — ${a.zip} ${a.country}`);
      }
    }
  }

  if (r.cookies) {
    lines.push("");
    lines.push("## Cookies");
    lines.push(`- Total: ${r.cookies.total} (persistentes: ${r.cookies.persistentCount}, sessão: ${r.cookies.sessionCount})`);
    lines.push("### Top 30 domínios com cookies");
    for (const d of r.cookies.topDomains) lines.push(`- ${d.host} — ${d.count} (P:${d.persistent} S:${d.session})`);
  }

  if (r.bookmarks) {
    lines.push("");
    lines.push("## Favoritos");
    lines.push(`- Total: ${r.bookmarks.total} em ${r.bookmarks.folders} pastas`);
  }

  return lines.join("\n");
}
