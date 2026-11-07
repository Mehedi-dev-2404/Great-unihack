# Fola — team Cache Money (Great UNI Hack, Manchester)

Tracks: NatWest "AI-Powered Financial Inclusion & Resilience" + ElevenLabs "voice is core".

## What it is

A voice-first AI financial coach for underserved and vulnerable users. It coaches on two things:

- **Demographic:** benefits and council/government rules the user may qualify for (e.g. extra child benefit if they have 2+ children under 18).
- **Financial:** patterns in their transactions (e.g. a sudden YouTube Music subscription that doesn't fit their history), tracked against net worth.

It's an agent, not a chatbot. It takes actions (drafts and sends emails, fills forms, cancels or blocks subscriptions), but always asks permission first. If something is beyond it, it says so and suggests a lawyer or adviser.

## User journey

1. Open app → load profile + demographic + financial history from the database (dummy data for the demo).
2. Show notifications: demographic alerts + financial alerts.
3. Big round button = talk to the ElevenLabs voice agent. Small button underneath = text instead.
4. Agent explains the alert, asks only the follow-up questions relevant to that claim (e.g. "Are both children under 18?"), then proposes an action.
5. On approval it executes (email via MCP, form fill via Claude API, cancel the subscription).
6. Every action is saved as a dated report (useful as evidence for council or a lawyer).
7. Every new fact the user shares updates their profile so it never asks twice.
8. After a claim is done, it asks targeted questions to find other benefits. If the user doesn't qualify, it explains why, kindly.

## Judging criteria to optimise for

- **NatWest:** customer focus/accessibility, innovation, social impact and ethics, AI + predictive "financial time travel", feasibility.
- **ElevenLabs:** voice is core not an add-on, natural voices that work in the demo, audio makes something accessible that wasn't before.

## Demo flow (must work end to end)

- **A.** YouTube Music anomaly → agent flags it → user says cancel → email to vendor sent → report saved.
- **B.** Child benefit alert → agent asks if both kids are under 18 → yes → drafts claim email/form → report saved → asks about other eligibility.

## Stack

ElevenLabs (voice agent), Claude API (reasoning + tools), Lovable Pro (frontend), Python FastAPI backend.

## API contract (frontend and backend both stick to this)

```
GET  /api/profile              → user profile + net worth
GET  /api/notifications        → list of alerts {id, type: demographic|financial, title, body, severity}
POST /api/chat                 → {message} → {reply, pending_action?}
POST /api/actions/:id/approve  → executes the action, returns a report
POST /api/actions/:id/decline
GET  /api/reports              → reports, newest first
```

Any change to this contract must be posted on the board tagging @9ren4.
