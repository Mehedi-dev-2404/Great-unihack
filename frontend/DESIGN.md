---
name: Fola
description: A voice-first money coach drawn as a bus route you can see ahead.
colors:
  ground: "oklch(0.958 0.003 106)"
  ink: "oklch(0.178 0 0)"
  surface: "oklch(1 0 0)"
  blind: "oklch(0.178 0 0)"
  blind-foreground: "oklch(0.98 0 0)"
  signal: "oklch(0.866 0.177 90)"
  signal-soft: "oklch(0.962 0.068 96)"
  muted: "oklch(0.925 0.004 106)"
  muted-foreground: "oklch(0.43 0.008 106)"
  border: "oklch(0.885 0.005 106)"
  input: "oklch(0.8 0.006 106)"
  track-grey: "oklch(0.7 0.005 106)"
  stop-red: "oklch(0.53 0.2 28)"
  money-green: "oklch(0.51 0.13 150)"
  money-green-soft: "oklch(0.95 0.045 150)"
  amber: "oklch(0.52 0.13 60)"
  amber-soft: "oklch(0.955 0.045 80)"
  adviser-blue: "oklch(0.488 0.217 264)"
  adviser-blue-soft: "oklch(0.94 0.03 264)"
typography:
  display:
    fontFamily: "Overpass, Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Overpass, Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  figure:
    fontFamily: "Overpass, Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  blind: "0px"
  sm: "6px"
  md: "9px"
  card: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  gutter: "16px"
  card-inset: "20px"
  row: "8px"
  section: "40px"
  column-max: "480px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "48px"
  button-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "48px"
  button-success:
    backgroundColor: "{colors.money-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "56px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem"
    height: "48px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "44px"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  route-blind:
    backgroundColor: "{colors.blind}"
    textColor: "{colors.blind-foreground}"
    rounded: "{rounded.blind}"
    padding: "20px"
  talk-button:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "152px"
  talk-button-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.signal}"
  stop-dot:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "34px"
  money-badge:
    backgroundColor: "{colors.money-green-soft}"
    textColor: "{colors.money-green}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  nav-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-foreground}"
    height: "56px"
  nav-tab-active:
    textColor: "{colors.ink}"
---

# Design System: Fola

## Overview

**Creative North Star: "The Route Blind"**

Fola reads like bus wayfinding. Money is a route you can see ahead: paydays and bills are stops on a thick yellow line, Fola's fixes are the faster route, and every screen opens under a black destination blind that announces where you are going next. The system borrows the blind, the stop pole and the timetable column, and refuses the neobank default of a balance card over a feed of identical cards.

Density is low and targets are large. The app is a single phone column (480px max) on a warm-neutral ground, with white working cards carrying the route, the spotted list and the forecast. One loud colour, bus yellow, marks the things that move you along: the talk button, the route line, the active tab, the focus halo, highlighted text on the blind. Red is a stop at risk, green is money gained, and nothing else is allowed to shout.

Text is set for low vision and low literacy: an 18px root size (scaling to 20px and 23px through the text-size setting), Atkinson Hyperlegible for anything read, Overpass signage for blinds, stop names and figures, and tabular numbers everywhere so amounts line up like a timetable.

**Key Characteristics:**
- Black route blinds, edge to edge, square-cornered, at the top of every screen.
- Bus yellow as the single loud colour; stop red and money green as the only semantic voices.
- Stops: white discs with a thick ink ring on an 8px yellow line.
- Pill-shaped controls at 44-56px tall; 12px cards with a soft ambient shadow.
- Signage sans for names and figures, hyperlegible sans for reading.
- Motion only where it carries meaning: talk rings, the stop tick, captions rising in.

## Colors

A neutral ground, an ink-black shell and one bus yellow, with red and green reserved for risk and gain.

### Primary
- **Bus Yellow** (signal): the talk button, route lines, the active tab bar marker, the 6px focus halo, text selection, the headline stop name and key figures on the blind, the top edge of approval sheets.
- **Pale Ticket Yellow** (signal-soft): highlighted surfaces that belong to the route: the "chance" stop fill, new-item icon tiles, the "with Fola" payoff strip, the chat context banner.

### Neutral
- **Route-Blind Black** (blind): every screen header and the "Fola needs your yes" strip on approval cards. In dark mode it drops below the page ground.
- **Ink** (ink): body text, primary pill buttons, stop-dot rings, outline-button borders, focus outline, the pressed chip.
- **White Card** (surface): cards, chips, inputs, bottom nav, the stop-dot fill.
- **Neutral Ground** (ground): page background, the 6px collar around the talk button.
- **Kerb Grey** (muted-foreground): secondary text and inactive tabs, held at about 7:1 on the ground.
- **Muted Wash** (muted), **Hairline** (border), **Field Edge** (input): hover washes, card borders and dividers, 2px input outlines.
- **Track Grey** (track-grey): the thin "no change" track that runs beside the yellow route in the forecast.

### Semantic
- **Stop Red** (stop-red): a stop at risk (ring colour), negative forecast figures, risk notes, errors.
- **Money Green** (money-green, money-green-soft): money gained or saved, the "Yes, do it" button, done stops, "sorted" rows, money badges.
- **Amber** (amber, amber-soft): in progress, and negative amounts in neutral contexts.
- **Adviser Blue** (adviser-blue, adviser-blue-soft): "passed to adviser" status and confidence pills on the profile only.

### Named Rules
**The One Loud Colour Rule.** Bus yellow is the only saturated accent that may decorate. It marks movement and the next action. Red and green appear only when they mean risk or gain.

**The Blind Is Ink Rule.** Headers are route-blind black with white and yellow type. Yellow text sits on black, never on white.

## Typography

**Display Font:** Overpass (with Atkinson Hyperlegible, system sans fallback), weights 600-900
**Body Font:** Atkinson Hyperlegible (with system sans fallback), 400 and 700

**Character:** Overpass is transit signage: dense, heavy (800), tight tracking, used for what you would read off a blind or a stop pole. Atkinson Hyperlegible does all reading, chosen for letter distinction at low vision.

### Hierarchy
- **Display** (800, 2.1rem, 1.05): the headline on the Home blind ("Next stop: ..."), in bus yellow. Other blinds use 1.9-3xl at the same weight.
- **Headline** (800, 1.5rem, 1.15): card and section titles ("Route ahead", "Your next 12 months"). All h1-h3 default to Overpass 800 with -0.015em tracking and balanced wrapping.
- **Title** (700, 1.125rem, snug): list-item titles, action titles, stop labels.
- **Body** (400, 1rem = 18px at default size, 1.5): reading text, pretty-wrapped, tabular numerals on.
- **Label** (700, 0.875rem): dates above stop names, tab labels, definition terms on the blind, status pills. Sentence case.
- **Figure** (Overpass 800, tabular, -0.01em): every money amount and stop date, scaled with its context (lg to 2xl).

### Named Rules
**The Signage Figure Rule.** Money and dates are set as signage: Overpass 800 with tabular figures, right-aligned in columns, so amounts read like a timetable.

**The Root Scales Everything Rule.** Sizes are rem-based off an 18px root; the text-size setting raises the root (125%, 143.75%). Never set type in px.

## Layout

A single centred column, max 480px, 16px gutters, bottom padding clearing a fixed bottom tab bar (56px targets, safe-area aware). Blinds break out of the column and run full-bleed on wide screens while their content stays aligned to the column. On Home the blind carries 96px of bottom padding so the talk button overlaps it by 80px, straddling blind and ground. Cards stack with 40px between sections; card content insets 20px. Lists inside cards use three-column grids (dot, text, figure) with 8-12px row padding; the forecast uses a fixed timetable grid (label, 5.5rem, 5.5rem) under a 2px ink rule top and bottom. Horizontal chip rows scroll edge to edge. Desktop is the same phone column centred, not a reflow.

## Elevation & Depth

Mostly flat. Cards carry one soft ambient shadow plus a hairline border; blinds and the bottom nav are flat. The talk button gets a deeper, diffuse drop shadow and a 6px ground-coloured collar so it lifts off the blind. Sheets from the bottom use a square top edge with an 8px yellow border instead of a shadow. Print removes shadows entirely.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 1px 2px oklch(0.2 0 0 / 6%), 0 6px 18px -10px oklch(0.2 0 0 / 22%)`): every card and the reset dialog. Dark mode: `0 8px 24px -12px oklch(0 0 0 / 60%)`.
- **Talk lift** (`box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.5)`): the talk button only.

### Named Rules
**The Soft-Only Rule.** Shadows are diffuse and ambient. No hard offset shadows; structure comes from blinds, rules and rings.

## Shapes

Two families that never mix: square signage and round controls. Blinds, sheet tops and the approval-card strip are square (0px). Cards are gently rounded (12px); inner panels and previews use 9-16px. Every control is a pill or a disc: buttons, chips, inputs, badges, status pills, the talk button, avatar, icon tiles. Stops are discs with a 6px ring on an 8px rounded yellow bar. Thick strokes carry the world: 6px stop rings, 3px icon-tile and avatar rings, 2px outline buttons, chips and inputs, 2px timetable rules, 2px left rules on blind data.

## Components

### Buttons
Heavy, round and big enough for one thumb.
- **Shape:** full pill (999px), 48px minimum height, 700 weight, 0.5rem icon gap.
- **Primary:** ink fill, white text; hover mixes 18% white in.
- **Signal:** bus yellow fill, ink text; hover darkens 12%. Reserved for the forward action on a blind or the chat call button.
- **Success:** money green, white text, 56px and larger text when it is "Yes, do it" on an approval.
- **Outline:** transparent with a 2px ink border; hover fills with the muted wash. Used for "No", "Type instead", "Try again".
- **Ghost:** transparent; hover muted wash. Read aloud, captions toggle, secondary actions.
- **States:** press scales to 0.98; disabled 50% opacity; focus uses the global ring (3px ink outline, 2px offset, 6px yellow halo).

### Chips
- **Style:** white pill, 44px tall, 2px hairline border, 700 weight at 0.9rem; hover border turns ink.
- **State:** pressed (aria-pressed) fills ink with white text. Used as single-select filters.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** white card on neutral ground.
- **Shadow Strategy:** Soft (see Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 20px; list rows split by hairline dividers. Loading state is the same card at its eventual height with a pulse.

### Inputs / Fields
- **Style:** pill (search) or 24px-radius (chat composer), white fill, 2px field-edge border, 48px tall, 18px+ text.
- **Focus:** border turns ink; the global yellow halo applies on keyboard focus.

### Navigation
- **Bottom tab bar:** fixed, white, hairline top border, four equal tabs (icon 24px over a 0.875rem bold label). Inactive tabs are kerb grey; the active tab is ink with a heavier icon stroke and a 4px yellow bar at its top edge.
- **Blind header:** black, full-bleed, square. Sub-screens use a sticky compact blind with a back control.

### Route Blind (signature)
The top of every screen. Wordmark in yellow Overpass 900, a pill-outline status link (net worth) in white at 25% border, the headline stop name in yellow display type with its date in white, then a two-column data row: each value under a 2px left rule (white at 30% for facts, yellow for Fola, red for risk), label in small bold, figure in signage.

### Route and Stops (signature)
A vertical 8px bus-yellow bar drawn by the list itself, with 34px stop discs (white fill, 6px ink ring) per row. Tones: **chance** (yellow ring on pale yellow), **risk** (red ring), **here** (yellow fill), **done** (solid green). The forecast variant adds a 3px track-grey line beside the yellow one: "no change" versus "with Fola". The journey log uses the same list, so every record is a stop.

### Talk Button (signature)
A 152px bus-yellow disc with a 6px ground collar and talk-lift shadow, mic icon in ink, labelled underneath in Overpass 800 at 1.5rem. Active state inverts to ink with a yellow stop square. While listening or speaking, two yellow rings scale out from behind it (2.4s, staggered 1.2s; 1.1s when Fola speaks). Live captions under it rise in sentence by sentence; the previous sentence dims to 40%.

### Approval Card and Sheet
"Fola needs your yes": a card whose top is a square black blind strip with yellow Overpass text, then the action with its icon tile, figure, preview panel, and a two-up row of Yes (green, 56px) and No (outline, 56px). In voice mode the same content arrives as a bottom sheet with a square 8px yellow top edge. Outcomes collapse to a green-soft "Done" row or a muted "Not done. Nothing was sent." row.

### Badges and Status Pills
Pills at 4px x 12px, 0.875rem bold. Money badge: green-soft with green signage figures. Status: green (prepared and logged), amber (in progress), blue (passed to adviser).

### Motion
All motion uses `cubic-bezier(0.16, 1, 0.3, 1)`. **Stop tick** (520ms): the newest stop in the journey log scales 0.6 to 1.18 to 1 when its action is approved. **Caption in** (300ms): 6px rise and fade per sentence, no typewriter. **Talk rings** as above. UI transitions run 150ms. Reduced motion hides the rings and collapses every animation and transition.

## Do's and Don'ts

### Do:
- **Do** open every screen with a full-bleed, square, route-blind black header carrying yellow and white type.
- **Do** draw sequences of dated things (payments, months, records) as stops on the 8px yellow line with 34px ringed discs and tone states.
- **Do** set every money figure and stop date in Overpass 800 with tabular figures, right-aligned.
- **Do** make every control a pill or disc at least 44px tall (48px for buttons), with the global 3px ink outline plus 6px yellow halo on focus.
- **Do** use money green only for gain and the Yes action, stop red only for risk and errors.
- **Do** size type in rem off the 18px root so the text-size setting scales the whole app.
- **Do** honour reduced motion: rings off, animations collapsed.

### Don't:
- **Don't** add a second loud accent; bus yellow is the only decorative colour.
- **Don't** put yellow text on white or light surfaces; it belongs on the blind.
- **Don't** round the blinds or sheet tops; signage is square, controls are round.
- **Don't** use hard offset shadows or stacked heavy elevation; Soft and Talk lift are the whole vocabulary.
- **Don't** build screens as a balance card over a feed of identical cards.
- **Don't** add uppercase eyebrows or kickers above headings; labels are sentence-case data terms.
- **Don't** set reading text in Overpass or figures in Atkinson.
