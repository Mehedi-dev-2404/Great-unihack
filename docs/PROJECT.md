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
- **B.** UC child element alert. The two-child limit on Universal Credit was removed from 6 April 2026, but the user's UC still only includes 2 of their 3 children. The agent asks whether all three children live with them and are under 18 (or under 20 and in approved education) → yes → drafts the UC change-of-circumstances message/claim → report saved → asks about other eligibility.

All benefit and council rules are **real, current UK rules** with a gov.uk source. Never invent a rule.

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
GET  /api/forecast             → net-worth "financial time travel" projection
GET  /api/actions?status=pending → actions filtered by status (pending|approved|declined)
POST /api/actions              → {type, notification_id?, notes?} → creates a pending action (used by the voice agent)
POST /api/profile/facts        → {facts: {...}} → merges new facts into the profile, returns the profile
GET  /health                   → {status: "ok"}
```

Extra fields in any response are allowed; clients must ignore unknown fields.

### JSON shapes

```jsonc
// GET /api/profile
{ "id": "u01", "name": "...", "age": 34, "city": "Manchester", "council": "Manchester City Council",
  "household": { "adults": 1, "children": [ { "name": "...", "age": 9 } ] },
  "employment": "...", "monthly_income": 1450.0, "benefits": [ { "name": "Universal Credit", "monthly_amount": 0.0 } ],
  "facts": { "children_live_with_user": true },   // facts learned in conversation
  "net_worth": 812.40,
  "net_worth_history": [ { "month": "2025-12", "net_worth": 640.10 } ] }   // 12 months, oldest first

// GET /api/notifications → Notification[]
{ "id": "n-uc-child-element", "type": "demographic" | "financial", "title": "...", "body": "...",
  "severity": "low" | "medium" | "high", "rule_id": "uc_two_child_limit_removed" /* or */, "transaction_ids": ["t123"],
  "suggested_action": "submit_claim" | "cancel_subscription" | "send_email" | null }

// Action (pending_action in /api/chat, items in /api/actions)
{ "id": "a-…", "type": "cancel_subscription" | "send_email" | "submit_claim" | "fill_form",
  "title": "Cancel YouTube Music", "summary": "plain-English one-liner of what will happen",
  "status": "pending" | "approved" | "declined", "created_at": "ISO-8601",
  "notification_id": "n-…" | null,
  "draft": { "to": "...", "subject": "...", "body": "..." } | null,     // email drafts
  "form":  { "name": "...", "fields": { "field": "value" } } | null }   // form contents

// POST /api/chat
request  { "message": "...", "session_id"?: "..." }
response { "reply": "...", "pending_action"?: Action, "profile_updates"?: { ... } }

// Report (approve returns one; GET /api/reports lists them newest first)
{ "id": "r-…", "action_id": "a-…", "type": "...", "title": "...", "created_at": "ISO-8601",
  "summary": "...", "outcome": "sent" | "submitted" | "cancelled", "details": { /* the draft/form that was sent */ } }

// GET /api/forecast?months=12
{ "current_net_worth": 812.40, "horizon_months": 12,
  "baseline":    [ { "month": "2026-12", "net_worth": 790.0 } ],   // if nothing changes
  "with_actions": [ { "month": "2026-12", "net_worth": 1120.0 } ], // if pending/suggested actions are taken
  "assumptions": [ "Cancel YouTube Music saves £10.99/mo", "UC child element adds £303.94/mo" ] }
```

### Internal interface: api ↔ agent/brain.py

```python
# agent/brain.py
def chat(message: str, context: dict, history: list[dict] | None = None) -> dict:
    """context = {profile, transactions, rules, notifications}.
    Returns {reply, pending_action?: Action-without-id/status/created_at, profile_updates?: dict}."""

def draft_action(action_type: str, context: dict, notification: dict | None = None, notes: str | None = None) -> dict:
    """Returns an Action without id/status/created_at (title, summary, draft?, form?)."""
```

The API assigns `id`, `status` and `created_at`, persists actions in `data/actions.json`, merges `profile_updates` into `facts`, and falls back to a stub if brain.py is missing or errors.

Data files in `data/`: `profile.json`, `transactions.json` (`{id, date, description, merchant, amount, category}` with negative amount = money out), `rules.json` (`{id, name, type, description, eligibility, follow_up_questions, monthly_value, source_url, action_type}`), `actions.json`, `reports.json`.

Any change to this contract must be posted on the board tagging @9ren4.
