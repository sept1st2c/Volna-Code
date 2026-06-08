# DSA Voice Tutor — Project Brain

## What This Project Is
An autonomous DSA voice tutor. A user opens a browser, selects a DSA problem, connects via microphone, and talks to an AI tutor that guides them toward the solution without giving it away. The AI listens to their approach, reviews their code, gives graduated hints, and teaches the underlying intuition if they're stuck.

## The User (Engineer)
Junior engineer, beginner to agentic AI. Learns by building. Needs every concept explained as it appears in code. Always update AUDIT.md when adding or changing anything.

## Tech Stack
| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js (TypeScript) | React framework, handles UI + API routes |
| Voice I/O | LiveKit Agents (Python) | WebRTC voice pipeline: STT → LLM → TTS |
| STT | Groq Whisper | Free, fast, same API key as LLM |
| LLM | Groq Llama 3.3 70B | Free tier, fast inference (critical for voice) |
| TTS | Deepgram Aura | Free tier, low latency, native LiveKit support |
| AI State | LangGraph (Phase 2+) | Tutoring state machine — not in Phase 1 |
| Code Execution | Piston API (Phase 2+) | Free, sandboxed, no auth needed |
| Code Editor | Monaco (Phase 2+) | VS Code's editor as a React component |

## What We Ruled Out and Why
- Real-time keystroke analysis → too expensive (LLM call per keystroke), noisy
- Own code sandbox → security nightmare, use Piston API instead
- LangChain → overlap with LiveKit Agents, adds complexity without value in Phase 1
- Multiple languages → Python only for MVP
- User auth → anonymous sessions for MVP

## Current Phase: 1 — Voice Pipeline
Goal: User speaks → AI tutor responds. No code editor, no hints system, hardcoded to Two Sum.

## Phase Roadmap
- Phase 1: Voice pipeline (LiveKit + Groq + Deepgram) ← WE ARE HERE
- Phase 2: Code editor (Monaco) + code execution (Piston API) + "analyze my code" button
- Phase 3: LangGraph tutoring state machine (graduated hints, session tracking)
- Phase 4: Problem library, auth, progress tracking

## How to Run (Phase 1)
### Agent (Python)
```bash
cd agent
uv run python main.py dev
```
### Frontend (Next.js)
```bash
cd frontend
npm run dev
```

## Environment Variables
See `agent/.env.example` and `frontend/.env.example`

## Key Files
- `docs/AUDIT.md` — learning log, every file explained
- `agent/main.py` — boots the LiveKit agent
- `agent/tutor.py` — AI tutor system prompt + LLM logic
- `frontend/app/page.tsx` — main UI page
- `frontend/app/api/token/route.ts` — generates LiveKit room tokens
- `frontend/components/VoiceSession.tsx` — mic/speaker LiveKit logic
