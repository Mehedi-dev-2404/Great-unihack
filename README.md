# Fola

A voice-first AI money coach for people the banks and benefits system often miss: single parents, carers, people on low incomes, people new to the UK. You talk to Fola. It spots money you're missing out on and money leaking away, asks only the questions it needs, drafts the claim or cancellation email, and does it only after you say yes. Every action is saved as a dated report you can show the council, the Jobcentre or a lawyer.

Built by team Cache Money at Great UNI Hack 2026 (Manchester) for the NatWest "AI-Powered Financial Inclusion & Resilience" and ElevenLabs challenges.

**Live API:** https://fola-api-production.up.railway.app ([health](https://fola-api-production.up.railway.app/health))
**Voice agent:** ElevenLabs agent `agent_8801m6v89p3qe7c81q1f1zymx125` (voice "Alice", British; LLM Claude Sonnet 5.5)

## What it does

1. **Finds money you're owed.** A rules engine checks your profile against real UK benefit rules, each with a gov.uk source in `data/rules.json`: the Universal Credit child element now that the two-child limit has gone (from 6 April 2026), Council Tax single person discount, Healthy Start and free school meals.
2. **Spots money leaking away.** An anomaly detector flags new recurring charges that don't fit your history, e.g. a YouTube Music subscription that started recently.
3. **Talks it through.** Fola explains each alert out loud in plain English and asks only what your profile doesn't already answer, one question at a time. Anything you tell it is saved so it never asks twice.
4. **Acts, with permission.** It drafts the UC journal message or the cancellation email, tells you who it goes to and what it asks for, and only records it after a clear yes. If you say no, it drops it and stops.
5. **Keeps evidence.** Each approved action becomes a dated report.
6. **Warns before a bill bounces.** It walks your current-account balance forward through upcoming regular payments and your usual daily spending, and flags the first bill you can't cover, e.g. rent due two days before Universal Credit arrives. Then it offers a reminder or a small top-up from savings you already have.
7. **Shows where your money is heading ("financial time travel").** A 12-month net-worth projection: if nothing changes, with the actions you're sure of, and a best case if claims still being checked come through.
8. **Knows its limits.** For legal disputes, debt or crisis it points to Citizens Advice, StepChange, MoneyHelper or Samaritans instead of guessing.

## Demo flows

- **A. Unwanted subscription:** Fola flags YouTube Music → "did you mean to sign up?" → "no, cancel it" → cancellation email drafted → yes → report saved, about £130 a year back.
- **B. Universal Credit child element:** Amara has 3 children but her UC still pays for 2. Fola asks whether all three live with her and are under 18 → yes → drafts a change of circumstances message for her UC journal, asking for backdating to 6 April 2026 → yes → report saved → offers to look for other help.
- **C. Rent shortfall:** Fola opens with "your rent is due on Thursday the 12th and you may be about £80 short" → offers a reminder, then moving up to £90 from her credit union savings only if needed → yes → set up and logged. If there's nothing to move, it suggests talking to the landlord early, asking UC to pay the landlord directly (Alternative Payment Arrangement) and council crisis support.

Before a demo, reset the live state: `curl -X POST https://fola-api-production.up.railway.app/api/reset`

## What's real and what isn't

Honest status, so nobody has to guess:

| Works for real | Simulated or limited |
|----------------|----------------------|
| Live voice conversation (ElevenLabs agent, 8 webhook tools on our API) | **Nothing is actually sent.** Approving writes a dated report marked `simulated: true`; no email or DWP message leaves the app, and no reminder or transfer is set up with a bank. Fola says so if asked. |
| Claude drafts emails and claim messages and handles text chat | **Demo data only.** Amara is a made-up persona; transactions are generated (`data/mock/`). No bank connection (Open Banking would be the next step). |
| Rules engine with real, current UK rules and gov.uk sources | Only 4 benefit rules so far. |
| Anomaly detection and bill-shortfall prediction on transaction history | The forecast is a straight line from 3 months of average cash flow; it doesn't model one-off costs. |
| Facts learned in conversation update the profile | No login: one demo user, and state resets when Railway redeploys. |
| Rule-based fallback if Claude is unavailable | English only for now. |

## Architecture

```
Browser (frontend/, Lovable, React)
   │  @elevenlabs/react voice session        │  REST (VITE_API_URL)
   ▼                                          ▼
ElevenLabs agent ──webhook tools──▶ FastAPI backend (api/) ──▶ Claude API (agent/brain.py)
                                       │
                                       ├─ engine.py   rules engine, anomaly detector, forecast
                                       ├─ actions.py  template drafts + simulated execution
                                       └─ data/*.json profile, transactions, rules, actions, reports
```

| Folder | What |
|--------|------|
| `api/` | FastAPI app (`engine.py`: rules, anomalies, shortfall prediction, forecast). The full API contract is in [docs/PROJECT.md](docs/PROJECT.md). |
| `agent/brain.py` | Claude reasoning: chat, drafting actions, eligibility checks, fact normalisation. |
| `agent/elevenlabs/` | Voice agent config as code (prompt, voice, tools). Redeploy with `agent/elevenlabs/push.sh <API URL>`. |
| `data/` | Demo profile, transactions and UK benefit rules. |
| `frontend/` | Web app: notifications, big talk button, forecast, reports. |

## Run it locally

Backend (Python 3.10+):

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY (and ELEVENLABS_API_KEY to push the agent)
pip install -r requirements.txt
uvicorn api.main:app --port 8000
```

Without an Anthropic key the API still runs, using the rule-based fallback for chat and template drafts.

Frontend:

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Tests: `python3 -m pytest agent/tests` (`test_live.py` calls Claude and needs an API key).
