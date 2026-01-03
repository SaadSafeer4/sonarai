# VisionAI MVP 👁️🗣️

**Accessibility product for blind and low-vision users**

A proof-of-concept web application demonstrating the core intelligence layer for future smart glasses. This MVP enables users to understand their surroundings through voice interaction alone.

## 🎯 Key Differentiator

**Short-Term Memory**: Unlike existing solutions like Meta's "What's in front of me", this system remembers the last captured scene. Users can ask follow-up questions like "Where was the chair you mentioned?" and receive contextual answers.

## ✨ Features

- **Voice-First Interface**: Fully usable without looking at the screen
- **Scene Analysis**: Captures webcam images and describes surroundings with spatial awareness
- **Conversational AI**: Natural, concise responses with safety-focused language
- **Memory Persistence**: Maintains context for multi-turn conversations
- **Audio Feedback**: All interactions confirmed through sound

## 🏃 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your free API key at: https://makersuite.google.com/app/apikey

### 3. Run the App

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173).

### 4. Open in Browser

Navigate to: http://localhost:5173

## 🎤 How to Use

1. **Open the app** → You'll hear "VisionAI ready"
2. **Tap the big button** (or press Space)
3. **Say**: "What's around me?"
4. **Listen** to the scene description
5. **Ask follow-ups**: "Where was the chair?" or "Is there a clear path?"

## 🔑 Key Phrases

| Phrase | Action |
|--------|--------|
| "What's around me?" | Captures new image and describes scene |
| "What do you see?" | Captures new image and describes scene |
| "Where was the [object]?" | Uses memory to answer (no new capture) |
| "Tell me more about..." | Uses memory for details |

## 📁 Project Structure

```
VisionAI/
├── server/
│   └── index.js         # Express backend with Gemini API integration
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── styles.css       # UI styling
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── .env                 # API keys (create this)
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Client                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Webcam    │  │ Speech API  │  │   Short-Term        │ │
│  │   Capture   │  │ (STT/TTS)   │  │   Memory Store      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                     Express Backend                         │
│  POST /api/analyze  →  Gemini Vision (scene description)    │
│  POST /api/chat     →  Gemini Chat (conversational AI)      │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Browser Permissions Required

- **Camera**: For capturing scene images
- **Microphone**: For voice input
- **Audio**: For text-to-speech output

## 🚀 Future Vision

This MVP demonstrates the core loop for a smart glasses product:

1. Camera captures scene → **Smart glasses camera**
2. AI describes surroundings → **Cloud processing**
3. Voice reads description → **Bone conduction speaker**

The core intelligence layer (this code) remains unchanged when hardware evolves.

## 📝 Demo Script

For the incubator demo:

1. "Watch how a blind user can understand their environment"
2. Ask: "What's around me?"
3. Show the response being spoken aloud
4. "Now here's our differentiator - short-term memory"
5. Ask: "Where was the [object mentioned]?"
6. "Notice how it remembers the previous scene - no existing solution does this"

## ⚠️ Limitations (MVP)

- Single image capture (no live video)
- Browser-based speech recognition (may vary by browser)
- Requires internet connection for API calls
- No offline mode
- Memory resets on page refresh

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Vision AI**: Google Gemini 1.5 Flash
- **Voice**: Web Speech API (built into browsers)

---

*Built for startup incubator demo - VisionAI 2026*

