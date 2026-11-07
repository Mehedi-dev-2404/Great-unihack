# Voice screen: smooth captions (spec for frontend)

Mehedi listened to the live agent: the voice is good, but the stock widget's transcript jumps word by word and feels odd. Replace it with our own voice screen: a big round button and calm captions that fade in one sentence at a time.

## Build it with `@elevenlabs/react`, not the widget

```tsx
import { useConversation } from "@elevenlabs/react";

const AGENT_ID = "agent_8801m6v89p3qe7c81q1f1zymx125";

const conversation = useConversation({
  onMessage: ({ source, message }) => {
    // source: "ai" | "user"; message is the whole turn's text
    if (source === "ai") captions.push(splitSentences(message));
    else setLastUserLine(message);
  },
  onError: (e) => console.error(e),
});

// big round button
await navigator.mediaDevices.getUserMedia({ audio: true });
await conversation.startSession({
  agentId: AGENT_ID,
  connectionType: "webrtc",          // or "websocket"
  dynamicVariables: { user_name: profile.name.split(" ")[0] },  // "Amara"
});
// end: conversation.endSession()
// state: conversation.status ("connected" | ...), conversation.isSpeaking
```

I wrote the SDK names from memory, so check them against the installed `@elevenlabs/react` version. The agent is public (no signed URL needed). Its tools hit the live API itself, so the screen only needs to refetch `/api/notifications`, `/api/actions?status=pending` and `/api/reports` when a turn ends, so new drafts and reports show up while you talk.

## Caption behaviour

- **One sentence at a time.** Split each AI message into sentences. Reveal sentence 1 immediately, then each next one paced to speech: about `sentence.length / 15` seconds (roughly 15 characters a second at speed 0.95). If `isSpeaking` goes false, show any remaining sentences straight away.
- **Fade, don't type.** Each new sentence fades and rises in (opacity 0→1, translateY 6px→0, about 300ms ease-out). No typewriter or word-by-word effect.
- **Keep it short on screen.** Show at most the current and previous sentence; older lines fade to about 40% opacity and then scroll away. Use a big, readable size (≥22px, line-height 1.4, high contrast).
- **User's words:** one small, muted line above, e.g. "You: cancel it", replaced each turn.
- **Orb:** gently pulses while `isSpeaking`; shows a calm "listening" state when connected and not speaking.
- **Interruptions:** when the user talks over Fola, stop revealing the rest of that message.
- **Accessibility:** captions container `aria-live="polite"`; with `prefers-reduced-motion`, no movement, just show each sentence; captions on by default, with a toggle to hide them.
- The small "type instead" button can keep using `POST /api/chat` (same brain, same data).

## Copy rule

Fola never says a message "was sent": approval prepares it and logs a dated report (execution is simulated). Report cards should say "Prepared and logged · 7 Nov 2026", not "Sent".
