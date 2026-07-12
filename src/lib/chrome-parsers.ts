// Chrome/Chromium SQLite forensic parsers — runs entirely in the browser.
// Nothing is uploaded to the server; only aggregated reports are.
import initSqlJs, { Database } from "sql.js";

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (f) => `https://sql.js.org/dist/${f}`,
  });
  return SQL;
}

// Chrome/WebKit timestamps: microseconds since 1601-01-01 UTC.
const CHROME_EPOCH_DIFF_MS = 11644473600000;
export function chromeTimeToDate(ts: number | bigint | null | undefined): Date | null {
  if (ts == null) return null;
  const n = typeof ts === "bigint" ? Number(ts) : ts;
  if (!n || !isFinite(n)) return null;
  const ms = Math.floor(n / 1000) - CHROME_EPOCH_DIFF_MS;
  if (ms < 0 || ms > Date.now() + 86_400_000 * 365 * 5) return null;
  return new Date(ms);
}

export type ArtifactKind =
  | "history"
  | "login_data"
  | "web_data"
  | "cookies"
  | "bookmarks"
  | "unknown";

export interface ArtifactFile {
  file: File;
  name: string;
  size: number;
  sha256: string;
  kind: ArtifactKind;
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tablesOf(db: Database): Promise<Set<string>> {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  const set = new Set<string>();
  if (res[0]) for (const row of res[0].values) set.add(String(row[0]));
  return set;
}

export async function detectKind(file: File): Promise<ArtifactKind> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".json") || lower === "bookmarks") return "bookmarks";
  try {
    const sql = await getSql();
    const buf = new Uint8Array(await file.arrayBuffer());
    const db = new sql.Database(buf);
    const tables = await tablesOf(db);
    db.close();
    if (tables.has("urls") && tables.has("visits")) return "history";
    if (tables.has("logins")) return "login_data";
    if (tables.has("autofill") || tables.has("autofill_profiles") || tables.has("credit_cards")) return "web_data";
    if (tables.has("cookies")) return "cookies";
    return "unknown";
  } catch {
    return "unknown";
  }
}

// ---------- History ----------
export interface HistoryVisit {
  url: string;
  title: string;
  visitCount: number;
  typedCount: number;
  lastVisit: Date | null;
  hostname: string;
}
export interface DownloadItem {
  target: string;
  url: string;
  totalBytes: number;
  startTime: Date | null;
  endTime: Date | null;
  state: number;
}
export interface SearchTerm { term: string; url: string }
export interface HistoryReport {
  totalUrls: number;
  totalVisits: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  topDomains: { host: string; visits: number; urls: number }[];
  topUrls: HistoryVisit[];
  downloads: DownloadItem[];
  searchTerms: SearchTerm[];
  activityMatrix: number[][]; // [dow 0-6][hour 0-23]
  timeline: { date: string; visits: number }[]; // daily
}

function safeHost(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "—"; }
}

export async function parseHistory(buf: ArrayBuffer): Promise<HistoryReport> {
  const sql = await getSql();
  const db = new sql.Database(new Uint8Array(buf));
  const tables = await tablesOf(db);

  const urlsRes = db.exec(
    "SELECT url, title, visit_count, typed_count, last_visit_time FROM urls ORDER BY visit_count DESC"
  );
  const rows = urlsRes[0]?.values ?? [];
  const visits: HistoryVisit[] = rows.map((r) => ({
    url: String(r[0] ?? ""),
    title: String(r[1] ?? ""),
    visitCount: Number(r[2] ?? 0),
    typedCount: Number(r[3] ?? 0),
    lastVisit: chromeTimeToDate(r[4] as number),
    hostname: safeHost(String(r[0] ?? "")),
  }));

  // Domain aggregation
  const domainAgg = new Map<string, { visits: number; urls: number }>();
  for (const v of visits) {
    const d = domainAgg.get(v.hostname) || { visits: 0, urls: 0 };
    d.visits += v.visitCount;
    d.urls += 1;
    domainAgg.set(v.hostname, d);
  }
  const topDomains = [...domainAgg.entries()]
    .map(([host, x]) => ({ host, ...x }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20);

  // Activity heatmap from visits table
  const activityMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const dailyMap = new Map<string, number>();
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  if (tables.has("visits")) {
    const vRes = db.exec("SELECT visit_time FROM visits WHERE visit_time > 0");
    const vRows = vRes[0]?.values ?? [];
    for (const row of vRows) {
      const d = chromeTimeToDate(row[0] as number);
      if (!d) continue;
      activityMatrix[d.getDay()][d.getHours()]++;
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
      if (!periodStart || d < periodStart) periodStart = d;
      if (!periodEnd || d > periodEnd) periodEnd = d;
    }
  }

  // Downloads
  const downloads: DownloadItem[] = [];
  if (tables.has("downloads")) {
    const dRes = db.exec(
      "SELECT target_path, tab_url, total_bytes, start_time, end_time, state FROM downloads ORDER BY start_time DESC LIMIT 200"
    );
    for (const r of dRes[0]?.values ?? []) {
      downloads.push({
        target: String(r[0] ?? ""),
        url: String(r[1] ?? ""),
        totalBytes: Number(r[2] ?? 0),
        startTime: chromeTimeToDate(r[3] as number),
        endTime: chromeTimeToDate(r[4] as number),
        state: Number(r[5] ?? 0),
      });
    }
  }

  // Search terms
  const searchTerms: SearchTerm[] = [];
  if (tables.has("keyword_search_terms")) {
    const sRes = db.exec(
      "SELECT k.term, u.url FROM keyword_search_terms k JOIN urls u ON u.id = k.url_id ORDER BY u.last_visit_time DESC LIMIT 500"
    );
    for (const r of sRes[0]?.values ?? []) {
      searchTerms.push({ term: String(r[0] ?? ""), url: String(r[1] ?? "") });
    }
  }

  const timeline = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, visits]) => ({ date, visits }));

  const totalVisits = visits.reduce((s, v) => s + v.visitCount, 0);

  db.close();
  return {
    totalUrls: visits.length,
    totalVisits,
    periodStart,
    periodEnd,
    topDomains,
    topUrls: visits.slice(0, 50),
    downloads,
    searchTerms,
    activityMatrix,
    timeline,
  };
}

// ---------- Login Data ----------
export interface LoginEntry {
  origin: string;
  username: string;
  timesUsed: number;
  lastUsed: Date | null;
  passwordEncrypted: boolean;
}
export interface LoginReport {
  total: number;
  uniqueDomains: number;
  logins: LoginEntry[];
  topAccounts: { username: string; count: number }[];
}
export async function parseLoginData(buf: ArrayBuffer): Promise<LoginReport> {
  const sql = await getSql();
  const db = new sql.Database(new Uint8Array(buf));
  const res = db.exec(
    "SELECT origin_url, username_value, password_value, times_used, date_last_used FROM logins"
  );
  const rows = res[0]?.values ?? [];
  const logins: LoginEntry[] = rows.map((r) => ({
    origin: String(r[0] ?? ""),
    username: String(r[1] ?? ""),
    passwordEncrypted: !!(r[2] && (r[2] as Uint8Array).length > 0),
    timesUsed: Number(r[3] ?? 0),
    lastUsed: chromeTimeToDate(r[4] as number),
  }));
  const domainSet = new Set(logins.map((l) => safeHost(l.origin)));
  const acctMap = new Map<string, number>();
  for (const l of logins) {
    if (!l.username) continue;
    acctMap.set(l.username, (acctMap.get(l.username) || 0) + 1);
  }
  const topAccounts = [...acctMap.entries()]
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  db.close();
  return { total: logins.length, uniqueDomains: domainSet.size, logins, topAccounts };
}

// ---------- Web Data (autofill / addresses) ----------
export interface AutofillEntry { name: string; value: string; count: number; lastUsed: Date | null }
export interface AddressEntry { fullName: string; email: string; phone: string; address: string; city: string; zip: string; country: string }
export interface WebDataReport {
  autofill: AutofillEntry[];
  addresses: AddressEntry[];
  emails: string[];
  phones: string[];
  creditCardsCount: number;
}
export async function parseWebData(buf: ArrayBuffer): Promise<WebDataReport> {
  const sql = await getSql();
  const db = new sql.Database(new Uint8Array(buf));
  const tables = await tablesOf(db);

  const autofill: AutofillEntry[] = [];
  if (tables.has("autofill")) {
    const r = db.exec("SELECT name, value, count, date_last_used FROM autofill ORDER BY count DESC LIMIT 500");
    for (const row of r[0]?.values ?? []) {
      autofill.push({
        name: String(row[0] ?? ""),
        value: String(row[1] ?? ""),
        count: Number(row[2] ?? 0),
        // date_last_used here is unix seconds (not chrome epoch)
        lastUsed: row[3] ? new Date(Number(row[3]) * 1000) : null,
      });
    }
  }

  const addresses: AddressEntry[] = [];
  if (tables.has("autofill_profiles")) {
    // Chrome stores names/emails/phones in separate tables joined by guid
    const profRes = db.exec("SELECT guid, street_address, city, zipcode, country_code FROM autofill_profiles");
    for (const r of profRes[0]?.values ?? []) {
      const guid = String(r[0]);
      let fullName = "";
      let email = "";
      let phone = "";
      try {
        const n = db.exec(`SELECT full_name FROM autofill_profile_names WHERE guid='${guid.replace(/'/g, "")}'`);
        fullName = String(n[0]?.values[0]?.[0] ?? "");
      } catch { /* ignore */ }
      try {
        const e = db.exec(`SELECT email FROM autofill_profile_emails WHERE guid='${guid.replace(/'/g, "")}'`);
        email = String(e[0]?.values[0]?.[0] ?? "");
      } catch { /* ignore */ }
      try {
        const p = db.exec(`SELECT number FROM autofill_profile_phones WHERE guid='${guid.replace(/'/g, "")}'`);
        phone = String(p[0]?.values[0]?.[0] ?? "");
      } catch { /* ignore */ }
      addresses.push({
        fullName, email, phone,
        address: String(r[1] ?? ""),
        city: String(r[2] ?? ""),
        zip: String(r[3] ?? ""),
        country: String(r[4] ?? ""),
      });
    }
  }

  // Extract emails/phones from all autofill values (fallback)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,5}[\s.-]?\d{4}/g;
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const a of autofill) {
    for (const e of a.value.match(emailRegex) || []) emails.add(e.toLowerCase());
    for (const p of a.value.match(phoneRegex) || []) phones.add(p);
  }
  for (const a of addresses) {
    if (a.email) emails.add(a.email.toLowerCase());
    if (a.phone) phones.add(a.phone);
  }

  let creditCardsCount = 0;
  if (tables.has("credit_cards")) {
    const c = db.exec("SELECT COUNT(*) FROM credit_cards");
    creditCardsCount = Number(c[0]?.values[0]?.[0] ?? 0);
  }

  db.close();
  return {
    autofill,
    addresses,
    emails: [...emails].slice(0, 100),
    phones: [...phones].slice(0, 100),
    creditCardsCount,
  };
}

// ---------- Cookies ----------
export interface CookieDomain { host: string; count: number; session: number; persistent: number }
export interface CookiesReport { total: number; sessionCount: number; persistentCount: number; topDomains: CookieDomain[] }
export async function parseCookies(buf: ArrayBuffer): Promise<CookiesReport> {
  const sql = await getSql();
  const db = new sql.Database(new Uint8Array(buf));
  let res;
  try {
    res = db.exec("SELECT host_key, is_persistent FROM cookies");
  } catch {
    db.close();
    return { total: 0, sessionCount: 0, persistentCount: 0, topDomains: [] };
  }
  const rows = res[0]?.values ?? [];
  const map = new Map<string, CookieDomain>();
  let session = 0;
  let persistent = 0;
  for (const r of rows) {
    const host = String(r[0] ?? "").replace(/^\./, "");
    const isPersistent = Number(r[1] ?? 0) === 1;
    if (isPersistent) persistent++; else session++;
    const d = map.get(host) || { host, count: 0, session: 0, persistent: 0 };
    d.count++;
    if (isPersistent) d.persistent++; else d.session++;
    map.set(host, d);
  }
  db.close();
  return {
    total: rows.length,
    sessionCount: session,
    persistentCount: persistent,
    topDomains: [...map.values()].sort((a, b) => b.count - a.count).slice(0, 30),
  };
}

// ---------- Bookmarks (JSON) ----------
export interface BookmarkNode { name: string; url?: string; children?: BookmarkNode[] }
export interface BookmarksReport { total: number; folders: number; roots: BookmarkNode[] }
export async function parseBookmarks(buf: ArrayBuffer): Promise<BookmarksReport> {
  const text = new TextDecoder().decode(buf);
  const json = JSON.parse(text);
  let total = 0;
  let folders = 0;
  function walk(n: any): BookmarkNode {
    if (n?.type === "url") { total++; return { name: n.name, url: n.url }; }
    folders++;
    return { name: n?.name || "root", children: (n?.children || []).map(walk) };
  }
  const roots: BookmarkNode[] = [];
  const r = json?.roots || {};
  for (const key of Object.keys(r)) {
    if (r[key] && typeof r[key] === "object") roots.push(walk(r[key]));
  }
  return { total, folders, roots };
}

export interface ChromeReport {
  files: { name: string; sha256: string; size: number; kind: ArtifactKind }[];
  history?: HistoryReport;
  logins?: LoginReport;
  webData?: WebDataReport;
  cookies?: CookiesReport;
  bookmarks?: BookmarksReport;
}
