# SonarAI — Project Context

## What this is

Voice-first AI assistant for blind/low-vision users. The user speaks, the app optionally captures a camera frame, and Claude Haiku describes the scene and answers questions — all via text-to-speech. Built by Saad Safeer as a portfolio project demonstrating full-stack AI development.

GitHub: https://github.com/SaadSafeer4/sonarai

---

## Architecture

**Stack:** Express (Node.js) backend + React/Vite frontend, monorepo.

```
sonarai-main/
├── server/index.js          # Express server — all AI logic lives here
├── src/
│   ├── pages/Demo.jsx       # Main UI — traditional (tap-to-ask) mode
│   ├── components/
│   │   ├── StreamingMode.jsx  # Continuous frame analysis mode
│   │   └── ModeToggle.jsx     # Switches between modes
├── .env                     # ANTHROPIC_API_KEY (not committed)
└── .env.example             # Template
```

Dev: `npm run dev` starts both server (port 3001) and Vite client (port 5173) concurrently. Vite proxies `/api/*` to Express.

---

## AI Provider: Anthropic only

**Model:** `claude-haiku-4-5-20251001` — fastest Claude model, handles vision natively.

All AI goes through a single endpoint: `POST /api/chat`

Request shape:
```json
{
  "message": "What's around me?",
  "image": "data:image/jpeg;base64,...",   // optional — triggers vision
  "sceneContext": "...",                    // previous scene description (scene memory)
  "conversationHistory": [...]             // last 4 message pairs
}
```

Response: SSE stream of `{ text: "..." }` chunks, terminated with `{ done: true, tools: [...] }`.

**Why a single endpoint:** Previously used Together AI (vision) + Groq (chat) as two sequential calls (~2-3s total). Unified into one Claude Haiku call (~0.5-1s to first token).

---

## Key features and how they work

### Scene memory
`sceneMemory` state in Demo.jsx stores the last scene description. Passed as `sceneContext` to every `/api/chat` call so the model can answer follow-up questions ("where was the chair?") without re-capturing.

### Stateful conversation
`conversationHistory` keeps last 7 message pairs. Sent with every request so the model has conversational context.

### Agentic tool calling
Two tools defined in `server/index.js`:
- `flag_hazard` — model calls this when it detects obstacles/dangers. Logs to in-memory `hazardLog` array with timestamp.
- `recall_memory` — model calls this to surface stored scene context when answering memory questions.

Tool calls are executed server-side (no client round-trip). If model calls a tool before generating text, server runs the tool and makes a second Anthropic call for the continuation.

### Streaming TTS (traditional mode)
`streamResponse()` in Demo.jsx:
1. Opens SSE stream to `/api/chat`
2. Accumulates text into a buffer
3. On sentence boundary (`[.!?]` followed by whitespace), queues the sentence to Web Speech API immediately
4. User hears first sentence ~300ms after request fires instead of waiting for full response

### DIY streaming mode (continuous frames)
`StreamingMode.jsx` runs a `setInterval` every 2 seconds:
1. Captures frame from canvas
2. POSTs to `/api/chat` with image at 0.5 quality (lower than traditional mode to reduce payload)
3. Collects SSE response
4. Skips if Jaccard word similarity > 75% (scene hasn't changed)
5. Speaks description via TTS if not already speaking

This replaced the Overshoot third-party SDK — now the whole app uses one AI provider.

---

## What was migrated away from (and why)

| Removed | Replaced with | Reason |
|---|---|---|
| Groq (`llama-3.1-8b-instant`) | Claude Haiku | Tool calling support, single provider |
| Together AI (`Llama-Vision-Free`) | Claude Haiku (vision) | Eliminate second API call, one provider |
| Overshoot SDK | DIY `setInterval` + canvas | Removes dependency, full control, one API key |

---

## Environment setup

Only one key needed:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Copy `.env.example` → `.env` and fill it in. Get key at console.anthropic.com.

---

## Job application context

The project is used in Saad's job applications with this description:

> "I built SonarAI, a full-stack AI app with an Express/React architecture and multi-model LLM integration including scene memory for stateful conversations — the kind of agentic, context-aware systems that sit at the core of what you're building."

**Why each claim is true:**
- *Full-stack / Express+React* — Express backend, React+Vite frontend, monorepo
- *Multi-model LLM integration* — project has cycled through and integrated Gemini, OpenRouter, HuggingFace, OpenAI, Together AI, Groq, Overshoot, and now Anthropic; currently uses Haiku for all three tasks (vision, chat, streaming)
- *Scene memory for stateful conversations* — `sceneMemory` state + `conversationHistory` passed on every request
- *Agentic* — genuine LLM tool calling via Anthropic's tool use API (`flag_hazard`, `recall_memory`)
- *Context-aware* — model has scene context + conversation history on every call

---

## Things to work on / known gaps

- No persistent storage — scene memory and conversation history reset on page refresh
- No user auth
- Hazard log (`hazardLog` array in server) is in-memory only, resets on server restart
- The `api/` directory (chat.js, analyze.js etc.) contains old Vercel serverless stubs that are stale — not used in dev, would need updating for deployment
- `/api/health` endpoint now reports `model: claude-haiku-4-5-20251001` — good for debugging
