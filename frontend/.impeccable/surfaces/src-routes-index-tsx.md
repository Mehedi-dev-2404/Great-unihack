---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: ["src/routes/chat.tsx","src/routes/reports.index.tsx","src/routes/reports.$id.tsx","src/routes/profile.tsx"]
---

# Fola app shell (Home, Chat, Reports, Profile)

Scope: every app screen. Visitor mode: Operate. Audience: Amara, single parent on Universal Credit, phone in one hand; job: hear what Fola spotted, say yes or no, keep a record. Primary action: the big round talk button. Constraints: WCAG 2.2 AA, plain words, nothing runs without a yes, live API shapes from Great-unihack/docs/PROJECT.md.

## Direction contract

THESIS: Money as a bus route you can see ahead: paydays and bills are stops, Fola's fixes are the faster route. Refuses the neobank default of a balance card over a feed of identical cards.

OWN-WORLD: Route-blind black (#111) shell with bus yellow (#FFCC00) as the one loud colour (talk button, route line, active tab), white working surfaces on a neutral ground, stop-red for risk, green for money gained. Signage sans (Overpass) for blinds, stop names and numbers with tabular figures; Atkinson Hyperlegible for reading text. Stops are white discs with a thick black ring on a thick yellow line; square corners on blinds, 12px radius on cards.

STORY: She sees the next stop and what it costs, understands which stops Fola can make cheaper, taps talk or "Sort it", approves, and the stop turns green in her journey log.

FIRST VIEWPORT: Black blind header full width: "Next stop" label, yellow stop name + date, white amount; net worth chip top right. Yellow 152px talk button centred under it, "Talk to Fola", small "Type instead". Then "Route ahead" card: a vertical yellow line with the next 4 stops, today at top, the opportunity stop ringed yellow with "+£303.94/mo". Bottom tab bar, active tab marked yellow.

FORM: Bus wayfinding (route blind, stop pole, timetable columns), position 1 on my ordered list, chosen as IMPECCABLE'S PICK. seed:b5f9a2928e9eb8c7

Signature interaction: approving an action ticks its stop green on the route line and the journey log (reports) draws the new stop in; the 12-month forecast is two routes, "as things are" and "with Fola", diverging from today.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
