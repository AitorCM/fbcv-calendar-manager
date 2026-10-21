---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/index.html"]
---

# Surface brief: En pista web app

Scope: the whole single-page app (club picker, Próximos, Equipos y calendarios, Incompatibilidades). Mode: Operate.
Audience and job: club coordinators (desktop, weekly overview, conflict review) and families/players (phone, "when and where do we play next").
Constraints: Spanish copy; light and dark themes; club remembered and reflected in the URL; no invented data.

## Direction contract

THESIS: The app is the pabellón scoreboard you already trust: times and scores read as lit LED digits, everything else is a calm, dense working list. It refuses the category default of stacked marketing hero + one rounded card per match.

OWN-WORLD: Scoreboard-housing black shell (header, next-match panel, time tiles) with amber LED seven-segment digits whose unlit segments ghost faintly; a neutral cool ground; basketball-orange for actions and selection; Archivo at varying width (condensed for team strips, normal for body). Pixel-honest digits at fixed integer heights.

STORY: The visitor names their club once, sees this weekend's matches as a departures-style board ordered by day and time, opens any team's season by round, follows teams, adds them to their phone calendar, and coordinators clear venue clashes.

FIRST VIEWPORT: Dark 56px header (mark, club switcher, theme). Club bar with name, meta and tabs. Próximos board: day heading, rows of [LED time tile | team + category | rival | Local/Visitante | venue + map]. No club: centered "¿De qué club eres?" with inline searchable list.

FORM: Pabellón scoreboard, candidate 4 of 7; raised by the gate board (time-ordered fixed-column rows, one alert colour reserved for unconfirmed/changed) and Emigre bitmap (integer-multiple digit sizes). seed:9b4c12fa3a9785e5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
