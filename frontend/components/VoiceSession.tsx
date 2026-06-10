// VoiceSession.tsx — voice interface + "Analyze my code" button.
//
// Phase 2 change: now receives a `code` prop from page.tsx.
// When the user clicks "Analyze my code", the code is sent to the LiveKit agent
// via a data channel message. The agent receives it and reviews it in the voice conversation.
"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  DisconnectButton,
  useRoomContext, // NEW in Phase 2 — gives us access to the underlying Room object
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useState } from "react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

// AgentStatus — unchanged from Phase 1.
function AgentStatus() {
  const { state, audioTrack } = useVoiceAssistant();

  const label: Record<string, string> = {
    disconnected: "Tutor is joining...",
    connecting: "Tutor is joining...",
    initializing: "Tutor is starting...",
    listening: "Listening to you...",
    thinking: "Thinking...",
    speaking: "Tutor is speaking",
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-gray-400 uppercase tracking-widest">
        {label[state] ?? state}
      </p>
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        className="w-40 h-10"
        barCount={12}
      />
    </div>
  );
}

// AnalyzeButton — the "Analyze my code" button.
// Lives INSIDE <LiveKitRoom> because it needs useRoomContext() to access the room.
// useRoomContext() only works inside a <LiveKitRoom> tree — calling it outside crashes.
//
// How it sends code to the agent:
//   1. Gets the room object via useRoomContext()
//   2. Serializes the code to bytes (TextEncoder)
//   3. Calls room.localParticipant.publishData() — sends a raw data message to the room
//   4. The Python agent receives it via ctx.room.on("data_received")
//   5. The agent injects the code into the conversation and generates a voice reply
//
// topic: "code_snapshot" — a label so the agent knows what kind of data this is.
// If we add more data channel messages later (e.g. "test_result"), the agent
// can distinguish them by topic.
function AnalyzeButton({ code }: { code: string }) {
  const room = useRoomContext();
  const [sending, setSending] = useState(false);

  async function handleAnalyze() {
    if (!code.trim()) return;
    setSending(true);
    try {
      // TextEncoder converts a string to a Uint8Array (bytes).
      // LiveKit's publishData only accepts raw bytes, not strings.
      const encoded = new TextEncoder().encode(code);

      // publishData sends a raw data packet to everyone in the room.
      // reliable: true — guarantees delivery (vs lossy, which is fine for audio but not data).
      // topic: "code_snapshot" — our custom label so the agent knows what to do with it.
      await room.localParticipant.publishData(encoded, { reliable: true, topic: "code_snapshot" });
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={handleAnalyze}
      disabled={sending || !code.trim()}
      className="w-full px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-medium transition-colors"
    >
      {sending ? "Sending..." : "Analyze my code"}
    </button>
  );
}

// RoomUI — in-session UI. Now receives `code` prop to pass to AnalyzeButton.
function RoomUI({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <AgentStatus />
      <p className="text-xs text-gray-500 text-center">
        Speak your approach. Click below to ask the tutor to review your code.
      </p>
      <AnalyzeButton code={code} />
      <DisconnectButton className="w-full px-4 py-2 text-sm bg-red-900 hover:bg-red-700 rounded text-white transition-colors">
        End Session
      </DisconnectButton>
    </div>
  );
}

// VoiceSession — connection state machine + LiveKitRoom wrapper.
// Phase 2: accepts `code` prop, threads it down to RoomUI → AnalyzeButton.
export default function VoiceSession({ code }: { code: string }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  async function startSession() {
    setConnectionState("connecting");
    try {
      const res = await fetch("/api/token", { method: "POST" });
      if (!res.ok) throw new Error("Failed to get token");
      const data = await res.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setConnectionState("connected");
    } catch {
      setConnectionState("error");
    }
  }

  if (connectionState === "idle" || connectionState === "error") {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4">
        <p className="text-zinc-400 text-sm text-center">
          Start a session to talk to your tutor.
        </p>
        {connectionState === "error" && (
          <p className="text-red-400 text-xs">
            Failed to connect. Check your .env.local keys.
          </p>
        )}
        <button
          onClick={startSession}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
        >
          Start Session
        </button>
      </div>
    );
  }

  if (connectionState === "connecting") {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Connecting...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token!}
      serverUrl={wsUrl!}
      audio={true}
      video={false}
      onDisconnected={() => {
        setToken(null);
        setWsUrl(null);
        setConnectionState("idle");
      }}
    >
      <RoomAudioRenderer />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        {/* code is passed all the way down to AnalyzeButton inside LiveKitRoom */}
        <RoomUI code={code} />
      </div>
    </LiveKitRoom>
  );
}
