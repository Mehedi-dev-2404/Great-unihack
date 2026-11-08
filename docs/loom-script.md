# Fola: 3-minute Loom script

About 420 spoken words, which leaves room for Fola's replies. **[Brackets]** are what to do on screen. *Italics* are what you say to Fola.

**Before you record:**
- Reset the demo: `curl -X POST https://fola-api-production.up.railway.app/api/reset`
- Open https://frontend-three-delta-52.vercel.app, allow the microphone, and use headphones.

---

## 0:00–0:20 · Hook
**[Home screen, Amara's alerts showing]**

"This is Fola, a voice-first money coach for the people banks and the benefits system often miss: single parents, carers, people on low incomes. You don't fill in forms. You just talk."

## 0:20–0:45 · The problem
"Billions of pounds in UK benefits go unclaimed every year. Rules change and nobody tells you. On the sixth of April 2026 the Universal Credit two-child limit was removed. Amara has three children, but her UC still only pays for two. She's also about to be short on rent, and her bank won't say a word until the payment bounces."

## 0:45–1:25 · Demo C: rent shortfall
**[Point at the red rent stop on the route ahead, then press the big round button]**

"Fola looks ahead at her money. Her rent leaves on the twelfth, two days before Universal Credit arrives."

**[Let Fola say: "...about eighty pounds short. Want me to help sort it?"]**

*"Yes please. Can you move a bit from my savings?"*

**[Fola explains the top-up in one sentence]**

*"Yes."*

"It only uses an account already on her profile, and it never asks for card or account numbers out loud."

## 1:25–2:05 · Demo B: Universal Credit
*"What else did you find?"*

**[Fola explains the third child]**

"It only asks what it doesn't already know."

**[Fola: "Do all three children live with you and are they all under eighteen?"]**

*"Yes, they do."*

**[Fola drafts the UC journal message and asks for a yes]**

*"Yes, go ahead."*

"That's about three hundred pounds a month, backdated to April. Fola never acts without a clear yes."

## 2:05–2:25 · Demo A: subscription (keep it fast)
*"Anything else?"*

**[Fola flags YouTube Music]**

*"I never signed up for that. Cancel it."* → *"Yes."*

## 2:25–2:50 · Proof and honesty
**[Open Reports, then the forecast]**

"Every action becomes a dated report Amara can show the council, the Jobcentre or a solicitor. The forecast is honest: the line if nothing changes, what's confirmed, and the best case. It never counts money she hasn't qualified for."

"To be clear about what's real: the voice, the rules engine and the predictions are live. Sending is simulated for the demo, and every rule has a gov.uk source."

## 2:50–3:00 · Close
"Built with ElevenLabs, Claude and FastAPI. Fola: it finds what you're owed, warns you before a bill bounces, and only acts with your permission."

---

**If you're running over time:**
- Cut demo A first (save about 20 seconds).
- Then shorten the problem section to its first two sentences.
- If Fola goes off script, just answer naturally. The stop-when-you-say-no behaviour looks good on camera too.
