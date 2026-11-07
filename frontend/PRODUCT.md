# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: low-income families on benefits in the UK. Reference persona is Amara Okafor, 34, Manchester: single parent of three (3, 9, 14), part-time shop job, on Universal Credit, social rent. Tight budget, little time, often missing help she is entitled to and not noticing money leaking out (e.g. a subscription she never meant to keep). She uses a phone, often one-handed, often while doing something else.

Secondary audience for the hackathon demo: judges from NatWest (financial inclusion and resilience) and ElevenLabs (voice is core).

## Product Purpose

Fola is a voice-first AI money coach. It looks at two things only: who the user is (household, benefits, council) and what their money is doing (transactions, net worth). It spots missed help and money problems, explains them in plain words, and does the work (writes the email, fills the form, cancels the subscription) only after the user says yes. Everything it does is saved as a dated report the user can show the council, the Jobcentre, Citizens Advice or a lawyer.

Success: the user gets money back or stops losing it without needing to understand the system, and has a record proving what was done.

## Positioning

Standalone product with its own name and identity. It works on open-banking-style data from any bank; NatWest is the demo's data source, not the brand. No NatWest logos or colours.

The mechanism a neighbour can't copy truthfully: an agent, not a chatbot. It checks eligibility against fixed gov.uk rules (not AI opinion), proposes one concrete action with the evidence attached, executes only on explicit approval, and keeps an evidential record. Plus "financial time travel": a 12-month forecast of net worth, with and without Fola's suggestions.

## Operating Context

- Main interaction is a voice call with the Fola agent (ElevenLabs Conversational AI). Text chat is the fallback.
- The agent proposes actions; the screen shows an approval card; nothing runs until the user taps Yes or says yes.
- Demo flows that must work end to end: (A) YouTube Music anomaly → cancel → report saved; (B) UC two-child limit removed (6 Apr 2026) → "do all three children live with you?" → UC journal message → report saved → asks about other help.
- Demo is shown live on a laptop/projector, but the product is phone-first.

## Capabilities and Constraints

- Frontend: TanStack Start + React + Tailwind + shadcn/ui, synced with Lovable (commits to main sync into the Lovable editor; never rewrite pushed history).
- Backend: FastAPI at https://fola-api-production.up.railway.app (owned by Mehedi). Contract in Great-unihack/docs/PROJECT.md. Frontend falls back to mock data when VITE_API_URL is empty.
- Screens: Home (big round talk button + small "Type instead"), Chat, Reports (list + detail), Profile ("what Fola knows about you").
- Guidance, not regulated financial or legal advice. Refers out (Citizens Advice, StepChange, Shelter) when beyond its scope.
- Ethnicity and other special-category data never affect benefit decisions; optional, opt-in only.

## Brand Commitments

- Name: Fola. Team: Cache Money.
- Voice: plain, warm, calm, never judgemental. "Done", not "Resolved". Says why it asks something.
- Agent voice on ElevenLabs: "Alice".

## Evidence on Hand

- Real gov.uk rules and 2026-27 rates: Great-unihack/data/benefit_rules.json (sources listed).
- Mock personas: Great-unihack/data/mock/ (10 people) and the backend's main persona Amara in Great-unihack/data/.
- No real users, testimonials, partners or metrics exist. Do not fabricate any.

## Product Principles

1. Ask permission, every time. The user is always the one who acts.
2. Show the evidence. Every alert says which payments or which rule it is based on.
3. Guess first, ask later. Infer from bank data; ask only the question that unlocks real money, after Fola has already helped.
4. Voice first, screen second. Everything important can be heard; the screen confirms and records.
5. Leave a paper trail. Every action becomes a dated, printable record.

## Accessibility & Inclusion

- WCAG 2.2 AA is a fixed requirement: contrast, keyboard, screen readers, focus visibility, target size.
- Users include people with low literacy, low vision and English as a second language; plain words throughout and read-aloud everywhere support that.
