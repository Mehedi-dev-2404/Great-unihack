# Fola voice agent (ElevenLabs agents as code)

This folder defines the Fola voice agent for the ElevenLabs CLI (`@elevenlabs/cli` v1.9.0). It hasn't been pushed yet: nothing here exists on the ElevenLabs account until you run the push.

## What's here

| Path | What |
|------|------|
| `agents.json` | Agent registry. `agents push` writes the agent id into it on the first push. |
| `agent_configs/fola.json` | The full agent config: prompt, first message, LLM, voice, ASR, turn-taking and widget. |
| `prompts/system_prompt.md` | Readable copy of the system prompt. It is embedded verbatim in `fola.json`, so if you edit one, update the other. |
| `tools.json` | Tool registry. `tools push` writes the tool ids into it. |
| `tool_configs/*.json` | 8 webhook tools: `get_profile`, `get_notifications`, `save_facts`, `propose_action`, `approve_action`, `decline_action`, `get_reports`, `get_forecast`. |
| `tests.json`, `test_configs/` | Empty, scaffolded by `agents init`. |
| `push.sh` | Swaps in the backend URL, pushes the tools, links their ids into the agent, pushes the agent and prints the widget snippet. |
| `.env.example`, `.gitignore` | From `agents init`. Never commit `.env`. |

## Tools → backend endpoints

| Tool | Request |
|------|---------|
| get_profile | `GET /api/profile` |
| get_notifications | `GET /api/notifications` |
| save_facts | `POST /api/profile/facts` with `{facts: {...}}` |
| propose_action | `POST /api/actions` with `{type, notification_id, notes}` |
| approve_action | `POST /api/actions/{action_id}/approve` (action_id is a path param) |
| decline_action | `POST /api/actions/{action_id}/decline` |
| get_reports | `GET /api/reports` |
| get_forecast | `GET /api/forecast` |

`save_facts.facts` declares optional fields (children_living_with_user, all_children_under_18, children_ages, eldest_in_approved_education, employment_status, housing, monthly_rent_pounds, has_disability_or_health_condition, is_carer, subscription_wanted, other). This lets the LLM fill the object reliably. The backend should merge whichever keys arrive.

`propose_action.type` is one of: `cancel_subscription`, `submit_claim`, `send_email`, `fill_form` (same as the API). The response should include `id` and a plain-English `summary` for the agent to read aloud.

## Placeholder to swap

Every tool URL starts with the literal string:

```
https://API_BASE_URL
```

Replace it with the public HTTPS URL of the FastAPI backend (an ngrok or cloudflared tunnel, or a deploy). ElevenLabs calls the tools from its servers, so `localhost` won't work. `./push.sh <url>` does the swap for you.

## Voice

Shortlist (British English, all checked against the voice API):

| Name | voice_id | Accent | Why |
|------|----------|--------|-----|
| **Alice** (picked) | `Xb7hH8MSUJpSbSDYk0k2` | British, female, middle-aged | ElevenLabs premade voice. It's already on the account, so it needs no library add and has nothing to break on demo day. Clear and friendly, made for explaining things; good for accessibility. |
| Valory B | `YWmufCrZ2agGoSoVL8je` | British, female, middle-aged | Community voice built for customer care. Warm, calm and comforting, so the most "kind friend" option. Comes from the shared library, so add it to My Voices first. |
| Hayes M | `sIivXWc5MTlPIP3kJXhg` | British, male, middle-aged | Community voice. Calm, natural customer-care voice for AI agents; the best male option. Comes from the shared library, so add it to My Voices first. |

To switch voices, change `conversation_config.tts.voice_id` in `agent_configs/fola.json` and push again.

## Models

- LLM: `claude-sonnet-5-5`, temperature 0.3. It is in the config's allowed LLM list, and it handles careful tool use (it never approves without a yes) and calm plain English well. For lower latency, use `claude-haiku-4-5`.
- TTS: `eleven_flash_v2`, the low-latency conversational model, with `optimize_streaming_latency: 3` and speed 0.95, slightly slower for clarity.
- ASR: `scribe_realtime`, with keywords (Universal Credit, DWP, YouTube Music, and others).
- Language: `en`.

## First message and dynamic variable

```
Hi {{user_name}}, it's Fola. I've had a look through your account and spotted a couple of things worth a look, one could put money back in your pocket. Shall we go through them?
```

`user_name` is a dynamic variable (placeholder `Amara`, the demo user). The frontend should pass it when the session starts. With the widget:

```html
<elevenlabs-convai agent-id="AGENT_ID" dynamic-variables='{"user_name":"Amara"}'></elevenlabs-convai>
```

With the SDK, pass `dynamicVariables: { user_name: "Amara" }` to `startSession`. The overrides also allow the client to replace `first_message`.

## Push (later, after the backend URL exists)

```bash
cd agent/elevenlabs
elevenlabs auth status              # check you're logged in
./push.sh https://YOUR-BACKEND-URL  # swap URL, tools push, link tool ids, agents push, print widget
```

Or by hand:

```bash
# 1. replace https://API_BASE_URL in tool_configs/*.json
elevenlabs tools push                 # creates the tools, writes ids into tools.json
# 2. copy those ids into agent_configs/fola.json -> conversation_config.agent.prompt.tool_ids
elevenlabs agents push                # creates the agent, writes its id into agents.json
elevenlabs agents status
```

Get the widget snippet:

```bash
elevenlabs agents widget embed <agent_id>
```

## Caveats

- `tools add` and `agents add` upload as soon as you run them, even with `--dry-run`. Don't use them to experiment.
- Not verified, because it needs a write: whether `tools push` creates a tool that has no `id` yet in `tools.json`. The CLI shows such entries as "Not pushed yet", so it should. `push.sh` stops with a clear message if any tool is still missing an id afterwards.
