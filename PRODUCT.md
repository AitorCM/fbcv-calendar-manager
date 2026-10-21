# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, equally important:

- **Club coordinators** who manage many teams of one basketball club. They check upcoming fixtures across the whole club, browse each team's calendar, and review possible venue conflicts between their own teams, mostly on a desktop during the week.
- **Families and players** who want to know, quickly and usually from a phone, when and where their team plays next.

## Product Purpose

"En pista" reads the published FBCV (Federació de Bàsquet de la Comunitat Valenciana) calendars for the 2026–2027 season and reorganises them around a club: pick your club once, then see each team's next match, its full calendar by round, and any scheduling incompatibilities. Success is answering "when and where do we play?" in seconds, and letting a coordinator clear the conflict list without leaving the app.

## Positioning

The official FBCV site is organised by competition → category → group; a club with fifteen teams has to open fifteen pages. En pista inverts it: club first, every team in one place, plus a conflict review the federation does not offer.

## Operating Context

- Data is crawled twice a day by a GitHub Actions job and served from a Cloudflare Worker + D1 (or FastAPI + SQLite locally).
- Every match links back to its FBCV source page; the app never edits official schedules.
- Conflict reviews (resolved flag + note) are stored per club and shared by everyone who uses that club.

## Capabilities and Constraints

- Views: Próximos partidos (one next match per team, oldest category first), Calendarios (per team, per competition/phase, by round), Incompatibilidades (same-time or < 2 h gap at the same venue, filterable, reviewable).
- Times are Europe/Madrid. Some matches have no confirmed time or venue; these states must read clearly.
- Light and dark themes must both be supported.
- Interface language: Spanish (es-ES).

## Brand Commitments

- Product name "En pista"; data source credited as FBCV with a link to the official calendar page.

## Evidence on Hand

Real data only: clubs, teams, matches and venues from FBCV. No testimonials, usage figures or endorsements exist; none may be invented.

## Product Principles

1. Club first: the club is chosen once and remembered; everything else hangs from it.
2. The next match is the answer most people came for; put it before anything else.
3. Unknowns are explicit: "hora por confirmar" and "pabellón por confirmar" are states, not blanks.
4. Never pretend to be the federation: always point to the official source.
5. Works one-handed on a phone and densely on a desktop.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both themes, full keyboard operation of the club search and filters, respects reduced motion.
