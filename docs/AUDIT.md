# Project Audit Log

This file explains every file, package, and decision in the project.
Updated every time something is added or changed.

---

## Project Structure Overview

```
DsaTut/
├── CLAUDE.md                        ← project brain, auto-loaded by Claude Code
├── docs/
│   └── AUDIT.md                     ← this file, your learning log
├── agent/                           ← Python backend (the AI tutor lives here)
│   ├── pyproject.toml               ← Python project config + dependencies (managed by uv)
│   ├── .env                         ← your secret API keys (never commit this)
│   ├── .env.example                 ← template showing which keys are needed (safe to commit)
│   ├── main.py                      ← boots the agent, connects to LiveKit
│   └── tutor.py                     ← the AI tutor's personality and logic
└── frontend/                        ← Next.js app (what the user sees in browser)
    ├── package.json                 ← Node.js project config + dependencies
    ├── .env.local                   ← frontend secret keys (never commit this)
    ├── .env.example                 ← template for frontend keys
    ├── app/
    │   ├── page.tsx                 ← the one page the user sees
    │   └── api/token/route.ts       ← backend API route: generates LiveKit room tokens
    └── components/
        └── VoiceSession.tsx         ← LiveKit mic/speaker logic, connects to room
```

---

## Phase 1 Files

---

### `CLAUDE.md`
**What it is:** A markdown file at the project root that Claude Code automatically reads at the start of every session.

**Why we have it:** Without this, starting a new terminal session means Claude has no memory of our decisions — stack choices, what we ruled out, current phase. This file is the fix. It's not for the app itself, it's for the AI assistant helping build it.

**How it affects the system:** No runtime effect. Pure documentation. But critical for maintaining consistency across sessions.

---

### `agent/main.py`
**What it is:** The Python entry point for the LiveKit Agent.

**Why we need it:** Someone has to "start" the AI tutor. This file does three things:
1. Connects to LiveKit as a bot participant (joins the room)
2. Wires up the voice pipeline: Groq Whisper (STT) → Groq LLM → Deepgram (TTS)
3. Tells the agent to start listening and greet the user

**How it affects the system:** Without this running, there's no AI in the room. The user could connect their mic but nobody would answer. Think of it as the "start the tutor's shift" button.

**What you learn from it:** How a LiveKit Agent boots, what `JobContext` means, how STT/LLM/TTS are wired together in code.

**Key concept — WorkerOptions:** LiveKit uses a "worker" model. Your Python process registers itself with LiveKit's server saying "I'm available to handle sessions." When a user connects from the browser, LiveKit assigns that session to your worker. `WorkerOptions(entrypoint_fnc=entrypoint)` tells LiveKit which function to call when a new session starts.

---

### `agent/tutor.py`
**What it is:** The AI tutor's brain — system prompt and personality.

**Why we need it:** The LLM (Llama 3.3) is a general-purpose AI. Without a system prompt, it'll just chat casually. This file tells it: you are a strict DSA tutor, never give away answers, guide with questions, stay concise (it's a voice conversation). The system prompt is the single most important thing that shapes the tutor's behavior.

**How it affects the system:** Every conversation starts with this context loaded. The LLM will follow these instructions for the entire session.

**What you learn from it:** What a system prompt is, how `ChatContext` works in LiveKit Agents, why prompt engineering matters for agents.

**Key concept — ChatContext:** In LLM APIs, every conversation is a list of messages with roles: `system` (instructions), `user` (what the human said), `assistant` (what the AI said). `ChatContext` is LiveKit's way of managing this list. We pre-load it with the system prompt before the user says a word.

---

### `agent/.env` and `agent/.env.example`
**What it is:** `.env` holds your real secret API keys. `.env.example` is a copy with blank values — safe to share/commit so others know what keys they need.

**Why we need it:** API keys must NEVER be hardcoded in Python files. If you push a file with a real API key to GitHub, bots scan for it within seconds and abuse it. The `.env` file is listed in `.gitignore` so it never gets committed.

**How it affects the system:** The agent reads these at startup. If a key is missing or wrong, the agent crashes immediately with a clear error.

---

### `frontend/app/api/token/route.ts`
**What it is:** A Next.js API route (a small backend endpoint) that generates a LiveKit room token.

**Why we need it:** LiveKit requires every participant to have a signed token to join a room — like a ticket. The token proves they're allowed in. Tokens must be signed with your `LIVEKIT_API_SECRET`, which must never reach the browser. So the browser asks this server-side route to generate a token, and the route sends it back.

**How it affects the system:** Without a valid token, the browser's LiveKit SDK can't connect to the room, and the user can't talk to the agent.

**What you learn from it:** How API routes work in Next.js App Router, why tokens exist, the difference between public and secret environment variables.

**Key concept — Why tokens?** Imagine if anyone could join any LiveKit room just by knowing its name. Chaos. Tokens are time-limited, signed credentials that say "this user is allowed in room X for the next Y minutes." Your secret key signs them; LiveKit's server verifies the signature.

---

### `frontend/components/VoiceSession.tsx`
**What it is:** A React component that handles everything voice-related in the browser.

**Why we need it:** This component does the heavy lifting on the frontend:
1. Requests mic access from the browser
2. Fetches a token from your API route
3. Connects to the LiveKit room
4. Streams your mic audio to LiveKit
5. Plays back the AI's audio response

**How it affects the system:** This is the user's side of the voice call. The agent (`main.py`) is the other side. LiveKit's server is in the middle routing audio between them.

**What you learn from it:** How LiveKit's React SDK works, what WebRTC looks like from a developer's perspective, how React components manage connection state.

---

### `frontend/app/page.tsx`
**What it is:** The one page the user sees in the browser.

**Why we need it:** Someone has to render the UI. For Phase 1 it's intentionally minimal: a title, a "Start Session" button, and the `VoiceSession` component. No problem selector yet, no code editor — just connect and talk.

**How it affects the system:** Entry point for the user. Everything starts here.

---

## Packages Installed

### Python (agent/)
| Package | What it does |
|---|---|
| `livekit-agents` | Core LiveKit Agent framework — the voice pipeline |
| `livekit-plugins-groq` | Connects Groq to LiveKit for STT (Whisper) and LLM (Llama) |
| `livekit-plugins-deepgram` | Connects Deepgram to LiveKit for TTS |
| `livekit-plugins-silero` | VAD (Voice Activity Detection) — detects when user starts/stops speaking |
| `python-dotenv` | Loads `.env` file into environment variables |

**What is VAD?** Voice Activity Detection. Without it, your STT would try to transcribe silence, background noise, breathing. Silero VAD detects actual speech and only sends real audio to Whisper. This saves cost and massively improves accuracy.

### JavaScript (frontend/)
| Package | What it does |
|---|---|
| `@livekit/components-react` | Pre-built React components for LiveKit (audio visualizers, connection state) |
| `livekit-client` | Core LiveKit browser SDK — the actual WebRTC logic |
| `livekit-server-sdk` | Server-side SDK — used in the token API route to sign tokens |

---

---

## Phase 2 Files

---

### `frontend/components/CodeEditor.tsx`
**What it is:** The Monaco code editor component — the text area where the student writes Python.

**Why we need it:** Students need to write actual code, not just talk about it. Monaco is the same editor that powers VS Code. The `@monaco-editor/react` package wraps it as a React component in about 10 lines.

**How it affects the system:** Adds the code-writing surface to the UI. Also contains the "Run" button which calls `/api/execute`.

**What you learn from it:** Controlled components in React (the editor's value is owned by the parent via props), `async/await` for fetch calls, TypeScript interfaces.

**Key concept — Controlled component:** Monaco's `value={code}` means the editor *displays* whatever `code` contains. The parent (`page.tsx`) owns the state. When the user types, `onChange` fires and calls `onCodeChange(newValue)` which updates the parent's state, which flows back down to the editor. This "one source of truth" pattern is fundamental React.

---

### `frontend/app/api/execute/route.ts`
**What it is:** A Next.js API route that proxies code to the Piston API for sandboxed execution.

**Why we need it:** We can't run arbitrary user code on our own server — infinite loops, `import os`, etc. are dangerous. Piston runs code in isolated Docker containers. It's free, open source, and requires no API key.

**How it affects the system:** The "Run" button in `CodeEditor` calls this route. The route forwards the code to `emkc.org/api/v2/piston/execute` and returns stdout/stderr/exit code back to the browser.

**What you learn from it:** Why you proxy through your own backend instead of calling third-party APIs directly from the browser. How to forward a request (`fetch` inside an API route).

**Key concept — Sandboxed execution:** Piston runs each code snippet in a fresh Docker container with strict resource limits (CPU time, memory, no network access). Even if the student writes `while True: pass`, it times out safely. This is why we use it instead of building our own execution environment.

---

### `frontend/components/VoiceSession.tsx` (updated)
**What changed:** Added `code` prop, `AnalyzeButton` component, `useRoomContext()` import.

**Why:** The "Analyze my code" button needs to send the code to the agent. The only way to do this from the browser is via LiveKit's data channel, which requires access to the `room` object. `useRoomContext()` gets that — but it only works inside `<LiveKitRoom>`, which is why `AnalyzeButton` lives here and not in `CodeEditor`.

**Key concept — LiveKit data channel:** WebRTC supports sending arbitrary binary data between participants alongside audio/video. `room.localParticipant.publishData(bytes, { topic: "code_snapshot" })` sends a data packet. The Python agent receives it via `ctx.room.on("data_received")`. This is how non-audio information flows from browser to agent.

**Key concept — `useRoomContext()`:** A React hook from `@livekit/components-react` that returns the underlying `Room` object managed by `<LiveKitRoom>`. It must be called inside the `<LiveKitRoom>` tree — calling it outside throws an error because the context doesn't exist there.

---

### `frontend/app/page.tsx` (updated)
**What changed:** Added `"use client"`, `useState` for `code`, two-column grid layout, imports for both `VoiceSession` and `CodeEditor`.

**Why:** The `code` state needs to be shared between `VoiceSession` (sends it to agent) and `CodeEditor` (displays and edits it). React's rule is: shared state lives in the closest common parent. Here, `page.tsx` is that parent.

**Key concept — Lifting state up:** When two sibling components need the same piece of data, you "lift" the state to their common parent and pass it down as props. This is a core React pattern. `page.tsx` owns `code`, passes it to both children.

---

### `agent/main.py` (updated)
**What changed:** Added `from livekit import rtc` import and `on_data_received` event handler.

**Why:** The agent now needs to receive data channel messages from the browser. `rtc` is LiveKit's real-time communications module — it provides the `DataPacket` type and the `Room` event system.

**Key concept — Event-driven architecture:** Instead of polling "has new code arrived?", we register a listener that fires automatically when data arrives. This is more efficient and is the standard pattern in async systems. `@ctx.room.on("data_received")` is exactly like `addEventListener` in JavaScript.

---

## Packages Installed (Phase 2)

### JavaScript (frontend/)
| Package | What it does |
|---|---|
| `@monaco-editor/react` | Wraps the VS Code Monaco editor as a React component |

---

## Decisions Log

| Decision | Why |
|---|---|
| Groq for both STT and LLM | One API key, both free, fast inference = low voice latency |
| Deepgram for TTS | Free tier, explicitly designed for low-latency voice AI |
| Piston API for code execution (Phase 2) | Completely free, no auth, sandboxed, open source |
| Python only for code execution | Reduces test surface by 10x for MVP |
| Hardcoded to Two Sum in Phase 1 | Removes problem selection complexity, lets us focus on voice pipeline |
| No LangGraph in Phase 1 | Learn the basic agent loop first, add state machine in Phase 2 |
| No auth in Phase 1 | Anonymous sessions, ship faster, auth is a separate concern |
