import type { Calendar } from "./App";

const categories = ["senior", "junior", "cadete", "infantil", "alevin", "benjamin"];
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const categoryOrder = (value: string) => {
  const name = normalize(value);
  const index = categories.findIndex((category) => name.includes(category));
  if (index >= 0) return index;
  if (/division|primera feb|tercera feb|^llval femenina$/.test(name)) return 0;
  return categories.length;
};

export function upcomingMatches(calendars: Calendar[], now = Date.now()) {
  return calendars.map(({ team, groups }) => {
    const next = groups.flatMap((group) =>
      group.rounds.flatMap((round) => round.matches.map((match) => ({
        match,
        category: group.category,
      }))),
    ).filter(({ match }) =>
      match.starts_at && new Date(match.starts_at).getTime() >= now &&
      (match.home_score === null || match.away_score === null),
    ).sort((a, b) =>
      new Date(a.match.starts_at!).getTime() - new Date(b.match.starts_at!).getTime() ||
      a.match.id.localeCompare(b.match.id),
    )[0];
    return { team, match: next?.match ?? null, category: next?.category || team.categories || "" };
  }).sort((a, b) =>
    categoryOrder(a.category) - categoryOrder(b.category) ||
    a.team.name.localeCompare(b.team.name, "es"),
  );
}
