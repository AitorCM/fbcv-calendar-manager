---
name: En pista
description: The pabellón scoreboard for a basketball club's FBCV calendar; lit LED digits over a calm, dense working list.
colors:
  ground: "#eceef1"
  surface: "#ffffff"
  surface-2: "#f4f5f7"
  surface-3: "#e8ebef"
  line: "#dde1e6"
  line-strong: "#c3c9d1"
  text: "#12161b"
  text-2: "#444d58"
  text-3: "#636c78"
  accent: "#c2410c"
  accent-hover: "#a5370a"
  accent-contrast: "#ffffff"
  accent-ink: "#9a3412"
  accent-soft: "#fdeee4"
  selection: "#fbd3b8"
  shell: "#0d1117"
  shell-2: "#1a212b"
  shell-line: "#2a3340"
  shell-text: "#eef1f5"
  shell-text-2: "#a2adbb"
  led: "#ffb224"
  led-ghost: "rgb(255 178 36 / 0.09)"
  led-win: "#5ee08f"
  led-loss: "#ff7b72"
  home: "#0b6b4f"
  home-bg: "#e2f3ec"
  away: "#3d4a5c"
  away-bg: "#eaeef3"
  danger: "#b42318"
  danger-bg: "#fdecea"
  warning: "#8a4b06"
  warning-bg: "#fdf2d8"
  success: "#12733e"
  success-bg: "#e3f4ea"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 760
    lineHeight: 1.05
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 78"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 720
    lineHeight: 1.2
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 80"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 720
    lineHeight: 1.2
    fontVariation: "'wdth' 90"
  team-strip:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 720
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 82"
  scoreboard-name:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 740
    lineHeight: 1.1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontVariation: "'wdth' 100"
  body-sm:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 680
    letterSpacing: "0.05em"
  tile-label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  xs: "4px"
  chip: "5px"
  sm: "7px"
  md: "10px"
  lg: "12px"
  pill: "99px"
spacing:
  hair: "2px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "48px"
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  max-width: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
    typography: "{typography.body-sm}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-on-shell:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  icon-button:
    textColor: "{colors.text-3}"
    rounded: "{rounded.sm}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
  segmented-option-on:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "34px"
  chip-toggle-on:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    height: "40px"
  time-tile:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.led}"
    rounded: "{rounded.sm}"
    padding: "7px 10px 8px"
    width: "88px"
  side-pill-home:
    backgroundColor: "{colors.home-bg}"
    textColor: "{colors.home}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  side-pill-away:
    backgroundColor: "{colors.away-bg}"
    textColor: "{colors.away}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  tag-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    rounded: "{rounded.chip}"
    padding: "3px 8px"
  day-flag:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  board:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  fixture-row:
    padding: "10px 12px 10px 10px"
  scoreboard:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 14px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "52px"
    padding: "0 8px 0 14px"
  header-shell:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-text}"
    height: "56px"
---

# Design System: En pista

## Overview

**Creative North Star: "The Pabellón Scoreboard"**

En pista looks like the scoreboard every family already trusts in a sports hall. A near-black housing (the shell) carries the things that are *lit*: the 56px header, the next-match panel, and every time tile. Inside the housing, kick-off times and final scores are drawn as amber seven-segment LED digits whose unlit segments stay faintly visible. Everything outside the housing is a calm, cool-grey working list: dense, hairline-divided, readable at a glance.

The system is built from one variable family, Archivo, used at different widths: condensed for team names and scoreboard strips, normal width for running text. Colour is disciplined by job: amber LED means "this is a readout", basketball orange means "you can act on this or you have selected it", and the green/red/amber state pairs mean exactly one thing each. Depth comes from the shell's darkness against the light ground and from hairline borders, not from shadows.

Both themes share the same housing: in dark mode the ground and surfaces stay a visible step lighter than the near-black shell, so the housing still reads as a separate object; the orange brightens to stay legible, and the LED colours do not change.

**Key Characteristics:**
- Dark scoreboard housing with amber seven-segment LED digits for times and scores.
- Departures-board lists: fixed-column rows inside one bordered board, divided by hairlines.
- One variable sans (Archivo) whose width axis carries hierarchy: condensed for names, normal for prose.
- Basketball orange reserved for actions, selection, and the active tab.
- Flat surfaces; shadows only on floating layers (switcher panel, toast).
- Light and dark themes with identical structure.

## Colors

A cool neutral ground, a black-housing family with its own LED palette, one orange action accent, and paired tint/ink state colours.

### Primary
- **Basketball Orange** (accent): primary buttons, the active-tab underline, focus rings, caret, selected chip borders, followed-team stars, the "Hoy" day flag and count badges. Hover deepens to **Burnt Orange** (accent-hover). In dark mode it lifts to a lighter orange so it reads on the dark ground.
- **Orange Ink** (accent-ink): the text-safe orange for links, text buttons, back links, and the name of a selected team.
- **Orange Wash** (accent-soft): the background of a selected list row, the "next round" row, a selected chip, and the search field's 3px focus halo.

### Secondary
- **Scoreboard Housing** (shell): header bar, time tiles, the next-match scoreboard, the club monogram, the pressed segment of a segmented control, toasts. **Housing Raised** (shell-2) and **Housing Seam** (shell-line) give buttons and dividers inside the shell.
- **Housing Text** (shell-text) and **Housing Muted** (shell-text-2): text and labels on the shell.

### Tertiary
- **LED Amber** (led): seven-segment digits, the brand mark stroke, the season readout, the own team's name on the scoreboard, icons inside the scoreboard.
- **Unlit Segment** (led-ghost): amber at 9% alpha, the always-visible ghost of every unlit segment.
- **LED Win Green** (led-win) and **LED Loss Red** (led-loss): the digit colour of a played match's tile, and the toast's check icon.

### Neutral
- **Cool Ground** (ground): the page behind everything.
- **Paper** (surface), **Paper Hover** (surface-2), **Paper Pressed** (surface-3): list containers, row hover, icon-button hover and skeleton bars.
- **Hairline** (line) and **Hairline Strong** (line-strong): row dividers and container borders; input and secondary-button borders.
- **Ink** (text), **Ink Secondary** (text-2), **Ink Tertiary** (text-3): primary text, rival names and labels, metadata and counts.

### State pairs
Each state is a foreground plus a tinted background, used together on tags, pills and notes: **Home Green** (home / home-bg) for "Local", **Away Slate** (away / away-bg) for "Visitante", **Danger** (danger / danger-bg) for errors, **Warning** (warning / warning-bg) for "por confirmar" text and round notes, **Success** (success / success-bg) for resolved conflicts. Conflict types are neutral text with an icon ("Misma hora" set heavier than "N min entre inicios"); amber stays reserved for "por confirmar".

### Named Rules
**The Two Lights Rule.** LED amber is for readouts. Orange is for things you can press or have selected. Never use LED amber for an action control, and never use orange for a time or score.

**The Paired State Rule.** State colours always appear as a tint background with its own ink (home-bg/home, warning-bg/warning). Don't put state ink on paper as bare text, except the warning ink of "por confirmar" text.

## Typography

**Display Font:** Archivo Variable (with Archivo, system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** the same family at normal width (`wdth` 100)

**Character:** One grotesque used the way a scoreboard is lettered: team names squeezed and heavy, running text open and plain. Weights land on in-between values (560, 620, 680, 720, 740, 760) of the variable axis rather than the 400/700 defaults.

### Hierarchy
- **Display** (760, 2.25rem, 1.05, `wdth` 78): only the "¿De qué club eres?" welcome heading; 1.875rem on phones.
- **Headline** (720, 1.625rem, `wdth` 80): the selected team's name above its calendar; 1.375rem on phones.
- **Title** (720, 1.375rem, 1.2, `wdth` 90): view titles and pane titles. The club name in the club bar sits between title and headline (740, 1.5rem, `wdth` 82).
- **Team strip** (720, 1.0625rem, `wdth` 82): team names in board rows; team list items use 700, 1rem, `wdth` 82. Rival names drop to 560, 0.9375rem, `wdth` 88.
- **Scoreboard name** (740, 1.375rem, 1.1, `wdth` 72, uppercase): home and away names inside the scoreboard panel.
- **Body** (400, 1rem, 1.45): default text. **Body small** (0.875rem) for metadata, meta lines and buttons; 0.8125rem for category, town and footer.
- **Label** (680, 0.8125rem, 0.05em, uppercase): board day headings ("Sábado 24 de octubre").
- **Tile label** (650, 0.6875rem, 0.05em, uppercase): the word above LED digits ("Victoria", "Por confirmar", the date); 0.625rem on small tiles.
- **Brand** (760, 1.1875rem, `wdth` 72, 0.04em, uppercase): the "En pista" wordmark only.

### Named Rules
**The Width Axis Rule.** Hierarchy for names comes from the width axis: the narrower the setting (72 to 90), the more "scoreboard" the text is. Body copy stays at `wdth` 100. Don't load a second family for display.

**The Tabular Numbers Rule.** Every count, date, and meta line with numbers uses `font-variant-numeric: tabular-nums` so columns of figures don't jitter.

**The Lit Digits Rule.** Kick-off times and scores are never typeset. They render through the seven-segment component, at fixed whole-pixel heights (16px small, 22px default, 40px large, 56px large on desktop), on the shell.

## Layout

A single centred column, max 1200px, with a 16px gutter on phones and 32px from 720px up. The page stacks: 56px shell header, white club bar (identity, then a sticky tab strip with a 1px bottom hairline), then content with 24px top and 48px bottom padding. Views are grids with a 20px gap; board sections use 8px between heading and board.

The board is the core layout: rows in a five-column grid (time tile | team + category | rival | venue | actions) with an 18px column gap. Below 720px each row reflows into three areas, with the tile pinned left spanning the rows and the team, rival and venue stacked beside it. Calendars use a 56px round-number column (30px on phones). From 960px the Equipos view becomes a 300px sticky team list next to the calendar; below that it is list-then-detail with a back link.

Spacing steps are 2, 6, 8, 12, 16, 20, 24 and 48px; row padding is about 10px vertical. Breakpoints: 720px (phone/desktop) and 960px (two-pane teams view).

### Named Rules
**The Departures Board Rule.** A list of matches is one bordered board with hairline dividers between fixed-column rows, ordered by day and time. Don't put each match in its own card.

## Elevation & Depth

The system is flat. Depth comes from contrast between the dark shell and the light ground, from tonal steps (surface, surface-2, surface-3), and from 1px hairlines. The only shadow is a pop shadow for layers that float above the page.

### Shadow Vocabulary
- **Pop** (`box-shadow: 0 12px 32px -8px rgb(13 17 23 / 0.28), 0 2px 6px rgb(13 17 23 / 0.08)`; dark: `0 16px 40px -8px rgb(0 0 0 / 0.6), 0 2px 6px rgb(0 0 0 / 0.4)`): the club switcher panel and the toast only.
- **Focus halo** (`box-shadow: 0 0 0 3px` accent-soft): the search field's focus-within state.

### Named Rules
**The Flat Board Rule.** Boards, cards, tiles and the scoreboard never cast shadows. If it doesn't float over content, it has no shadow.

## Shapes

Gently squared corners on a short scale: 7px for controls, tiles and the monogram; 10px for boards, inputs and cards; 12px for the scoreboard, the switcher panel and empty states; 5px for pills, tags and segmented options; 4px for skeleton bars, the focus ring and the round "next" mark; fully round (99px) only for the day flag and count badges. Borders are 1px solid hairlines; empty states and boxed notes use a 1px dashed strong hairline. The active tab is a 3px orange bar with rounded top corners sitting on the strip's bottom hairline. LED digits are slanted (-6° skew) polygons with bevelled segment ends.

Icons are one authored set on a 20px grid, 1.75 stroke, round caps and joins, outline by default; the star fills when a team is followed.

## Components

### Buttons
Compact and solid; text plus optional 18px icon.
- **Shape:** gently squared (7px), 40px tall, 14px side padding, 620 weight at 0.875rem.
- **Primary:** orange fill with white text (dark text in dark mode); hover deepens the orange. Background, border and colour transition at 150ms ease-out.
- **Secondary:** paper fill with a strong hairline; hover moves to paper-hover and darkens the border. When toggled on, its icon turns orange.
- **On shell:** housing-raised fill with a seam border, for controls in the header; hover lightens the border.
- **Icon button:** 36px square, transparent, tertiary ink; hover fills with paper-pressed. A "raised" variant has paper fill and a hairline.
- **Text button:** orange ink, underlined, 3px offset.
- **Disabled:** 50% opacity, not-allowed cursor.

### Segmented control and chip toggles
- **Segmented:** a paper tray with a hairline and 3px inset; 34px options at 5px radius. The pressed option fills with the housing black and housing text, a small piece of scoreboard.
- **Chip toggle:** a 40px hairline chip; when on, orange border, orange wash and orange ink.

### Boards and lists
- **Corner style:** 10px, 1px hairline border, paper background, overflow clipped.
- **Rows:** hairline between rows; hover fills paper-hover; selected or next fills orange wash. A stretched link covers the whole row, and keyboard focus draws a 2px orange outline inset on the row.
- **Day heading:** uppercase label above the board, with the right-aligned count at normal case; today's heading carries the orange "Hoy" day flag.

### Inputs / Fields
- **Search field:** 52px (42px compact), 10px radius, strong hairline, a leading search icon. Focus-within turns the border orange and adds a 3px orange-wash halo.
- **Select, date, textarea:** 40px, 7px radius, strong hairline; hover darkens the border; focus draws a 2px orange outline with no offset and an orange border.
- **Conflict board:** incompatibilities are grouped under a day + venue board heading; each clashing pair is one board row with small LED tiles per match, a neutral type label, an outlined "Resolver" button (orange only on hover) and an optional note behind an icon button.
- **Labels:** 650 weight, 0.8125rem, secondary ink.

### Navigation
- **Header (shell):** 56px housing bar with the LED-stroked brand mark, the uppercase condensed wordmark, a season readout (hidden on phones), and on-shell controls on the right: club switcher and theme toggle.
- **Club switcher:** opens a 440px paper panel (12px radius, pop shadow, 160ms pop-in from 6px above); on phones it spans the viewport width under the header and the button shows only its icon.
- **Tabs:** sticky white strip, 24px apart on desktop and equal-width on phones; 620 weight, secondary ink; the current tab turns to ink with a 3px orange bar.

### Time Tile (signature)
The scoreboard cell. A housing-black block (88px minimum, 76px small, 7px radius) holding seven-segment digits in LED amber, with an optional uppercase tile label above. Unconfirmed times show "--:--" with the label "Por confirmar". Played matches show the club's score first, in LED green for a win or LED red for a loss, labelled "Victoria", "Derrota" or "Empate".

### Scoreboard panel (signature)
The team's next match as a real scoreboard: a 12px housing block with a header line (amber "Próximo partido", date), a three-column body (home name | bordered LED clock | away name, the own team in LED amber), and a footer split by a seam showing the venue with an amber pin. Large digits play a 520ms stepped "power-on" flicker once. On phones the clock sits above the two names.

### Pills, tags and badges
- **Side pill:** 5px radius, 0.6875rem uppercase 700; home green or away slate pair.
- **Tag:** 5px radius, 0.75rem 680; danger, warning, success, or neutral (paper-pressed with secondary ink).
- **Count badge / day flag:** fully round orange with white text.

### States
- **Skeleton:** paper-pressed bars with a 1.3s shimmer; tile skeletons match the tile size.
- **Error panel:** danger wash, a border of danger at 30%, ink text and a retry action.
- **Empty panel:** dashed strong hairline, 12px radius, centred 28px icon, a 700 heading and secondary-ink copy.
- **Toast:** housing-black bar with 10px corners at the bottom centre, pop shadow, LED-green check, 200ms rise-in.

## Do's and Don'ts

### Do:
- **Do** draw every kick-off time and score with the seven-segment component on the housing black, at its fixed pixel heights (16, 22, 40, 56px).
- **Do** keep unlit segments visible at 9% amber; the ghost is part of the readout.
- **Do** set team and rival names in condensed Archivo (`wdth` 72 to 90) and prose at `wdth` 100.
- **Do** list matches as rows in one hairline-divided board, ordered by day then time.
- **Do** show unknown time or venue as an explicit state: "--:--" with "Por confirmar" on the tile, warning-ink "por confirmar" text for venues.
- **Do** use the 2px orange focus outline (2px offset, inset on rows) on every interactive element.
- **Do** honour reduced motion: the global reduced-motion rule collapses animations and transitions to 1ms.

### Don't:
- **Don't** use LED amber for buttons, links, or selection, and don't use orange for times or scores.
- **Don't** give each match its own floating card or add shadows to boards, tiles, or the scoreboard.
- **Don't** introduce a second typeface or set times in a monospace face to imitate the LED.
- **Don't** change the LED colours between themes; only the ground, surfaces, text, and orange adapt.
- **Don't** use a state colour without its paired tint, or reuse home green or danger red for decoration.
