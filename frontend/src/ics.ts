import type { Calendar, Match } from "./api";

const stamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
// RFC 5545 lines must stay under 75 octets; continuation lines start with a space.
const encoder = new TextEncoder();
const fold = (line: string) => {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 73) {
      out.push(current);
      current = " ";
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n");
};

function event(m: Match, category: string, now: Date) {
  const start = new Date(m.starts_at!);
  const lines = [
    "BEGIN:VEVENT",
    `UID:fbcv-${m.id}@enpista`,
    `DTSTAMP:${stamp(now)}`,
  ];
  if (m.time_confirmed) {
    lines.push(
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + 90 * 60e3))}`,
    );
  } else {
    const d = m.starts_at!.slice(0, 10).replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${d}`);
  }
  lines.push(
    `SUMMARY:${escape(`${m.home_team} – ${m.away_team}`)}`,
    `DESCRIPTION:${escape(
      `${category}${m.time_confirmed ? "" : "\nHora por confirmar."}\nFuente: ${m.source_url}`,
    )}`,
  );
  const location = [m.venue, m.address, m.town].filter(Boolean).join(", ");
  if (location) lines.push(`LOCATION:${escape(location)}`);
  lines.push(`URL:${m.source_url}`, "END:VEVENT");
  return lines.map(fold).join("\r\n");
}

/** Builds an iCalendar file with the team's dated, unplayed matches. */
export function teamIcs(calendar: Calendar, now = new Date()) {
  const events = calendar.groups.flatMap((g) =>
    g.rounds.flatMap((r) =>
      r.matches
        .filter(
          (m) =>
            m.starts_at &&
            new Date(m.starts_at).getTime() >= now.getTime() - 864e5 &&
            (m.home_score === null || m.away_score === null),
        )
        .map((m) => event(m, g.category, now)),
    ),
  );
  return {
    count: events.length,
    text: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//En pista//Calendarios FBCV//ES",
      "CALSCALE:GREGORIAN",
      fold(`X-WR-CALNAME:${escape(calendar.team.name)}`),
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
  };
}

export function downloadIcs(calendar: Calendar) {
  const { text } = teamIcs(calendar);
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${calendar.team.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
