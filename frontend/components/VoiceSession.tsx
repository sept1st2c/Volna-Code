"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  DisconnectButton,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useState } from "react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

// AgentStatus shows what the AI tutor is currently doing.
// useVoiceAssistant is a LiveKit hook that tracks the agent's state.
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
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-400 uppercase tracking-widest">
        {label[state] ?? state}
      </p>
      {/* BarVisualizer shows an animated waveform when the AI speaks */}
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        className="w-48 h-12"
        barCount={12}
      />
    </div>
  );
}

// The inner room UI — only rendered once LiveKit is connected.
function RoomUI() {
  return (
    <div className="flex flex-col items-center gap-8">
      <AgentStatus />
      <p className="text-xs text-gray-500 max-w-xs text-center">
        Speak naturally. The tutor is listening. Ask about your approach to Two Sum.
      </p>
      <DisconnectButton className="px-4 py-2 text-sm bg-red-900 hover:bg-red-700 rounded text-white transition-colors">
        End Session
      </DisconnectButton>
    </div>
  );
}

export default function VoiceSession() {
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
      <div className="flex flex-col items-center gap-4">
        {connectionState === "error" && (
          <p className="text-red-400 text-sm">
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
    return <p className="text-gray-400 text-sm animate-pulse">Connecting...</p>;
  }

  // LiveKitRoom handles the WebRTC connection.
  // audio=true means it will capture the user's microphone automatically.
  // RoomAudioRenderer plays the AI's audio back through the speakers.
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
      <RoomUI />
    </LiveKitRoom>
  );
}
