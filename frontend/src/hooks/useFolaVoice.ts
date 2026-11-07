import { useConversation } from "@elevenlabs/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, qk } from "@/lib/api";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking";
export interface Caption {
  id: number;
  text: string;
}

const AGENT_ID = (import.meta.env["VITE_ELEVENLABS_AGENT_ID"] as string | undefined) ?? "";
/** Roughly how fast the agent speaks (characters per second at speed 0.95). */
const CHARS_PER_SECOND = 15;

const DEMO: { who: "user" | "ai"; text: string }[] = [
  { who: "ai", text: "Hi, I'm listening. What would you like to sort out today?" },
  { who: "user", text: "Is there anything I'm paying for that I don't need?" },
  {
    who: "ai",
    text: "I spotted a YouTube Music subscription. It started in September. I can prepare a message to cancel it. Shall I?",
  },
];

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Voice conversation with Fola (spec: Great-unihack/docs/voice-captions.md).
 * Live ElevenLabs agent when VITE_ELEVENLABS_AGENT_ID is set, otherwise a scripted demo.
 * Fola's words are revealed one sentence at a time, paced to speech.
 */
export function useFolaVoice(userName?: string) {
  const qc = useQueryClient();
  const [mockStatus, setMockStatus] = useState<VoiceStatus>("idle");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [userLine, setUserLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const pending = useRef<string[]>([]);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mockTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  const show = (text: string) =>
    setCaptions((cs) => [...cs.slice(-3), { id: ++seq.current, text }]);

  const stopRevealing = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    pending.current = [];
  };

  const revealNext = useCallback(() => {
    const next = pending.current.shift();
    if (!next) {
      revealTimer.current = null;
      return;
    }
    show(next);
    revealTimer.current = setTimeout(
      revealNext,
      Math.max(1200, (next.length / CHARS_PER_SECOND) * 1000),
    );
  }, []);

  const flush = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    const rest = pending.current;
    pending.current = [];
    rest.forEach(show);
  };

  const onFolaSays = useCallback(
    (text: string) => {
      stopRevealing();
      pending.current = splitSentences(text);
      revealNext();
    },
    [revealNext],
  );

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.notifications });
    void qc.invalidateQueries({ queryKey: qk.pending });
    void qc.invalidateQueries({ queryKey: qk.reports });
  }, [qc]);

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (role === "user") {
        // The user talked: stop revealing the rest of Fola's last message.
        stopRevealing();
        setUserLine(message);
      } else {
        onFolaSays(message);
        refresh();
      }
    },
    onDisconnect: () => {
      setLive(false);
      api.setVoiceListening(false);
      refresh();
    },
    onError: () => setError("Voice dropped. Tap to try again, or type instead."),
  });

  // When Fola stops speaking, show anything not yet revealed straight away.
  useEffect(() => {
    if (live && !conversation.isSpeaking && pending.current.length) flush();
  }, [conversation.isSpeaking, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMock = () => {
    mockTimers.current.forEach(clearTimeout);
    mockTimers.current = [];
  };

  const startMock = useCallback(() => {
    clearMock();
    setMockStatus("connecting");
    let at = 1000;
    DEMO.forEach((turn, i) => {
      mockTimers.current.push(
        setTimeout(() => {
          if (i === 0) api.setVoiceListening(true);
          if (turn.who === "user") {
            stopRevealing();
            setUserLine(turn.text);
            setMockStatus("listening");
          } else {
            setMockStatus("speaking");
            onFolaSays(turn.text);
            mockTimers.current.push(
              setTimeout(
                () => setMockStatus("listening"),
                (turn.text.length / CHARS_PER_SECOND) * 1000,
              ),
            );
          }
        }, at),
      );
      at += Math.max(2500, (turn.text.length / CHARS_PER_SECOND) * 1000 + 1200);
    });
  }, [onFolaSays]);

  const reset = () => {
    stopRevealing();
    setCaptions([]);
    setUserLine("");
  };

  const start = useCallback(async () => {
    setError(null);
    reset();
    if (!AGENT_ID) return startMock();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Fola needs your microphone. Allow it in your browser, or type instead.");
      return;
    }
    setLive(true);
    api.setVoiceListening(true);
    conversation.startSession({
      agentId: AGENT_ID,
      connectionType: "webrtc",
      dynamicVariables: { user_name: userName ?? "there" },
    });
  }, [conversation, startMock, userName]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    clearMock();
    setMockStatus("idle");
    if (live) conversation.endSession();
    setLive(false);
    api.setVoiceListening(false);
    reset();
  }, [conversation, live]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      clearMock();
      stopRevealing();
      api.setVoiceListening(false);
    },
    [],
  );

  const liveStatus: VoiceStatus =
    conversation.status === "connected"
      ? conversation.isSpeaking
        ? "speaking"
        : "listening"
      : "connecting";
  const status = live ? liveStatus : mockStatus;

  return {
    start,
    stop,
    status,
    isSpeaking: status === "speaking",
    captions,
    userLine,
    error,
    isLive: live,
  };
}
