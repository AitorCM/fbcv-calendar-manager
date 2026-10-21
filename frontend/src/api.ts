export type Club = { id: string; name: string; team_count: number };
export type Team = {
  id: string;
  name: string;
  match_count: number;
  group_count: number;
  categories: string;
};
export type Match = {
  id: string;
  home: boolean;
  home_team: string;
  away_team: string;
  starts_at: string | null;
  time_confirmed: boolean;
  venue: string | null;
  town: string | null;
  address: string | null;
  home_score: string | null;
  away_score: string | null;
  message: string | null;
  source_url: string;
};
export type Round = {
  number: string;
  nominal_date: string | null;
  rest: boolean;
  matches: Match[];
};
export type Group = {
  id: string;
  name: string;
  category: string;
  phase: string;
  rounds: Round[];
};
export type Calendar = { team: Team; groups: Group[] };
export type Meta = {
  season_label: string;
  updated_at: string | null;
  status: string;
};

export async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok)
    throw new Error(
      "No se han podido cargar los datos. Comprueba tu conexión y vuelve a intentarlo.",
    );
  return r.json();
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const TZ = "Europe/Madrid";
const parse = (s: string) =>
  new Date(s.length === 10 ? `${s}T12:00:00+02:00` : s);
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...opts });
const shortDay = fmt({ day: "numeric", month: "short" });
const weekdayShort = fmt({ weekday: "short", day: "numeric", month: "short" });
const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
const longDate = fmt({ day: "numeric", month: "long" });
const clockFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const isoDay = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const day = (s: string) => shortDay.format(parse(s));
export const dayWithWeekday = (s: string) => weekdayShort.format(parse(s));
export const longDayLabel = (s: string) => longDay.format(parse(s));
export const longDateLabel = (s: string) => longDate.format(parse(s));
export const clock = (s: string) => clockFmt.format(new Date(s));
/** Calendar day in Madrid, as YYYY-MM-DD. */
export const localDay = (s: string | Date) =>
  isoDay.format(typeof s === "string" ? parse(s) : s);

export function relativeDay(s: string, now = new Date()) {
  const target = localDay(s);
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getTime() + 864e5));
  if (target === today) return "Hoy";
  if (target === tomorrow) return "Mañana";
  return null;
}

export const isPlayed = (m: Match) =>
  m.home_score !== null && m.away_score !== null;

export const rival = (m: Match) => (m.home ? m.away_team : m.home_team);

export function outcome(m: Match): "win" | "loss" | "draw" | null {
  if (!isPlayed(m)) return null;
  const own = Number(m.home ? m.home_score : m.away_score);
  const other = Number(m.home ? m.away_score : m.home_score);
  if (Number.isNaN(own) || Number.isNaN(other)) return null;
  return own > other ? "win" : own < other ? "loss" : "draw";
}

export function mapsUrl(m: Pick<Match, "venue" | "address" | "town">) {
  const query = [m.venue, m.address, m.town].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

export function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return (words.slice(0, 2).map((w) => w[0]).join("") || name.slice(0, 2))
    .toUpperCase();
}

export const FBCV_URL =
  "https://www.fbcv.es/competiciones/calendario-resultados-y-clasificacion/";
