// VoiceSession.tsx — the voice interface component.
// Handles everything voice-related on the frontend:
//   1. Fetching a LiveKit token from the API route
//   2. Connecting to the LiveKit room (WebRTC)
//   3. Streaming the student's mic audio to LiveKit
//   4. Playing the AI tutor's audio back through the speakers
//   5. Showing the tutor's current state (listening / thinking / speaking)

// "use client" — CRITICAL directive.
// Next.js App Router renders components on the server by default (faster, SEO-friendly).
// But anything involving the browser — microphone, WebRTC, useState, event listeners —
// must run client-side. This tells Next.js: "run this in the browser, not on the server."
// Without it, the build crashes because useState and WebRTC don't exist server-side.
"use client";

import {
  LiveKitRoom,       // root component that establishes the WebRTC connection
  RoomAudioRenderer, // invisible component that plays all room audio through speakers
  useVoiceAssistant, // React hook: gives us the AI agent's live state + audio track
  BarVisualizer,     // animated waveform bars that react to the AI's audio
  DisconnectButton,  // pre-built button that cleanly ends the LiveKit session
} from "@livekit/components-react";
import "@livekit/components-styles"; // default CSS for LiveKit components (needed for BarVisualizer)
import { useState } from "react";

// TypeScript union type — connectionState can ONLY be one of these four strings.
// This prevents typos: if you write setConnectionState("conecting"), TypeScript
// catches it at compile time before you even run the code.
type ConnectionState = "idle" | "connecting" | "connected" | "error";

// AgentStatus — shows what the AI tutor is currently doing.
// This is a separate component (not inline in VoiceSession) because it uses
// useVoiceAssistant(), which only works inside a <LiveKitRoom> tree.
// Keeping it separate makes that boundary clear.
function AgentStatus() {
  // useVoiceAssistant() is a LiveKit React hook.
  // It reaches into the LiveKitRoom context (set up by the parent component)
  // and returns real-time info about the AI agent:
  //   state      — current step in the pipeline: "listening" | "thinking" | "speaking" etc.
  //   audioTrack — a reference to the AI's audio stream (used by BarVisualizer)
  const { state, audioTrack } = useVoiceAssistant();

  // Maps LiveKit's internal state strings to human-readable labels.
  // The ?? operator: if label[state] is undefined (unknown state), fall back to state itself.
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
      {/* BarVisualizer renders animated bars that move with the AI's audio waveform.
          state — controls the animation mode (idle bars vs active bars)
          trackRef — the actual audio stream to visualize (from useVoiceAssistant)
          barCount — how many bars to render */}
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        className="w-48 h-12"
        barCount={12}
      />
    </div>
  );
}

// RoomUI — the in-session UI, rendered only once LiveKit is connected.
// Separated from VoiceSession so it can safely use LiveKit hooks (AgentStatus uses one).
function RoomUI() {
  return (
    <div className="flex flex-col items-center gap-8">
      <AgentStatus />
      <p className="text-xs text-gray-500 max-w-xs text-center">
        Speak naturally. The tutor is listening. Ask about your approach to Two Sum.
      </p>
      {/* DisconnectButton is a LiveKit pre-built component.
          It cleanly ends the WebRTC session and triggers onDisconnected in LiveKitRoom. */}
      <DisconnectButton className="px-4 py-2 text-sm bg-red-900 hover:bg-red-700 rounded text-white transition-colors">
        End Session
      </DisconnectButton>
    </div>
  );
}

// VoiceSession — the main exported component, rendered in page.tsx.
// It manages the connection state machine:
//   idle → (user clicks Start) → connecting → (token fetched) → connected
//                                            → (error)        → error → idle
export default function VoiceSession() {
  // useState<T>(initialValue) — React's way of storing values that, when changed,
  // trigger a re-render of the component.
  // Pattern: const [value, setter] = useState(initial)
  // Calling setter(newValue) updates the value AND tells React to re-render.
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");

  // token and wsUrl start as null. They're populated after we call /api/token.
  // string | null — TypeScript union: the value is either a string or null.
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // startSession — fired when the user clicks "Start Session".
  // async function — can use await to pause and wait for the fetch to complete.
  async function startSession() {
    setConnectionState("connecting"); // immediately updates UI to show "Connecting..."

    try {
      // fetch() makes an HTTP request. Here: POST to our own /api/token route.
      const res = await fetch("/api/token", { method: "POST" });

      // res.ok is true if HTTP status is 2xx. If the server returned 4xx/5xx,
      // we throw an error to jump to the catch block below.
      if (!res.ok) throw new Error("Failed to get token");

      // res.json() parses the JSON response body into a JavaScript object.
      // Returns: { token: "eyJ...", wsUrl: "wss://...", roomName: "...", identity: "..." }
      const data = await res.json();

      // Store token and wsUrl in state. This triggers a re-render.
      // The new render sees connectionState === "connected" and renders <LiveKitRoom>.
      setToken(data.token);
      setWsUrl(data.wsUrl);
      setConnectionState("connected");
    } catch {
      // Any error (network failure, bad response, etc.) lands here.
      // We show the error state which displays a "Check your .env.local keys" message.
      setConnectionState("error");
    }
  }

  // Conditional rendering — React pattern for showing different UI based on state.
  // Each early return exits the function, so only one UI is shown at a time.

  if (connectionState === "idle" || connectionState === "error") {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Conditional expression: only renders the error message if state is "error" */}
        {connectionState === "error" && (
          <p className="text-red-400 text-sm">
            Failed to connect. Check your .env.local keys.
          </p>
        )}
        <button
          onClick={startSession} // calls startSession when clicked
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

  // We only reach here when connectionState === "connected".
  // At this point token and wsUrl are guaranteed to be non-null strings.
  //
  // LiveKitRoom — root component that establishes the WebRTC connection.
  //   token={token!}    — the JWT from /api/token. "!" tells TypeScript we know it's not null.
  //   serverUrl={wsUrl!} — the LiveKit cloud URL (wss://...)
  //   audio={true}      — automatically requests mic permission from the browser and
  //                        starts streaming the student's audio into the room.
  //   video={false}     — no camera needed for a voice-only tutor.
  //   onDisconnected    — fires when the session ends (End Session clicked or network drops).
  //                        Resets all state back to "idle" so the UI returns to Start Session.
  //
  // RoomAudioRenderer — invisible component that subscribes to all audio tracks in the room
  //   and plays them through the speakers. Without this, the AI's TTS audio arrives at the
  //   browser but you'd never hear it. Easy to forget — if you can't hear the AI, check this.
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
