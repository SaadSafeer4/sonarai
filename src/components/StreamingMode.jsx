import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RealtimeVision } from 'overshoot';

const NAVIGATION_PROMPT = `You are a visual assistant for blind users navigating their environment.
Describe what you see focusing on:
1. Obstacles and hazards (highest priority)
2. Clear paths for navigation
3. Spatial layout using directional language (left, right, ahead, behind)
Keep responses under 3 sentences. Be specific about distances and directions.
Example: "Clear path ahead. Chair on your left at 3 o'clock. Doorway on your right."`;

// Jaccard similarity to detect near-duplicate descriptions
function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export default function StreamingMode() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [sceneMemory, setSceneMemory] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [metrics, setMetrics] = useState({ framesProcessed: 0, newDescriptions: 0, sessionStart: null });
  const [error, setError] = useState(null);

  const visionRef = useRef(null);
  const videoRef = useRef(null);
  // Refs avoid stale closure issues in SDK callbacks
  const isStreamingRef = useRef(false);
  const lastDescriptionRef = useRef('');
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const speak = useCallback((text, priority = false) => {
    return new Promise((resolve) => {
      if (priority) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const english = voices.filter(v => v.lang.startsWith('en'));
      const voice = english.find(v =>
        v.name.includes('Google US') ||
        v.name.includes('Zira') ||
        v.name.includes('Samantha')
      ) || english[0] || voices[0];
      if (voice) utterance.voice = voice;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const startStreaming = useCallback(async () => {
    const apiKey = import.meta.env.VITE_OVERSHOOT_API_KEY;
    if (!apiKey) {
      setError('VITE_OVERSHOOT_API_KEY is not set. Add it to your .env file and restart the dev server.');
      return;
    }

    setError(null);
    setCurrentStatus('Connecting...');

    try {
      const vision = new RealtimeVision({
        apiKey,
        // Use "environment" for rear camera (navigation). Falls back gracefully on desktop.
        source: { type: 'camera', cameraFacing: 'environment' },
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        prompt: NAVIGATION_PROMPT,
        mode: 'frame',
        // Analyze a frame every 2 seconds — enough for navigation without overwhelming TTS
        frameProcessing: { interval_seconds: 2 },
        // 80 tokens / 2s interval = 40 effective tokens/sec, well within the 128/s limit
        maxOutputTokens: 80,
        onResult: (result) => {
          if (!result.ok || !result.result?.trim()) return;
          const description = result.result.trim();

          setMetrics(prev => ({ ...prev, framesProcessed: prev.framesProcessed + 1 }));

          // Skip if scene hasn't changed meaningfully (>75% word overlap)
          const isSimilar = wordSimilarity(description, lastDescriptionRef.current) > 0.75;
          if (isSimilar) return;

          lastDescriptionRef.current = description;
          setSceneMemory(description);
          setLastResponse(description);
          setMetrics(prev => ({ ...prev, newDescriptions: prev.newDescriptions + 1 }));

          // Don't interrupt if user is mid-question
          if (!isSpeakingRef.current && !isProcessingRef.current) {
            isSpeakingRef.current = true;
            speak(description).then(() => { isSpeakingRef.current = false; });
          }
        },
        onError: (err) => {
          console.error('[Overshoot]', err);
          const msg =
            err.name === 'UnauthorizedError'
              ? 'Invalid API key. Check VITE_OVERSHOOT_API_KEY in your .env file.'
              : `Stream error: ${err.message}`;
          setError(msg);
          isStreamingRef.current = false;
          setIsStreaming(false);
          setCurrentStatus('Error — try again');
        },
      });

      await vision.start();
      visionRef.current = vision;
      isStreamingRef.current = true;
      setIsStreaming(true);
      setCurrentStatus('Streaming...');
      setMetrics({ framesProcessed: 0, newDescriptions: 0, sessionStart: Date.now() });

      // Wire the camera feed into the video element for sighted helpers
      const stream = vision.getMediaStream();
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      speak('Streaming started. I will describe your surroundings as they change.', true);
    } catch (err) {
      console.error('[Stream start]', err);
      setError(err.message || 'Failed to start stream. Check camera permissions.');
      isStreamingRef.current = false;
      setIsStreaming(false);
      setCurrentStatus('Ready');
    }
  }, [speak]);

  const stopStreaming = useCallback(async () => {
    window.speechSynthesis.cancel();
    if (visionRef.current) {
      await visionRef.current.stop();
      visionRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    isStreamingRef.current = false;
    setIsStreaming(false);
    setCurrentStatus('Stopped');
    speak('Streaming stopped.', true);
  }, [speak]);

  const generateResponse = useCallback(async (userMessage) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        sceneContext: sceneMemory,
        conversationHistory,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    setConversationHistory(prev => [
      ...prev.slice(-6),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: data.response },
    ]);
    return data.response;
  }, [sceneMemory, conversationHistory]);

  const handleQuestion = useCallback(async (question) => {
    isProcessingRef.current = true;
    setIsProcessing(true);
    // Pause ongoing scene description so the answer is audible
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    try {
      const response = await generateResponse(question);
      setLastResponse(response);
      await speak(response, true);
    } catch (err) {
      await speak('Sorry, could not answer that. Check your connection.', true);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      if (isStreamingRef.current) setCurrentStatus('Streaming...');
    }
  }, [generateResponse, speak]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak('Speech recognition not supported. Try Chrome or Safari.');
      return;
    }
    setIsListening(true);
    setTranscript('');
    setCurrentStatus('Listening...');

    // Short audio cue
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    const timeout = setTimeout(() => recognition.stop(), 10000);

    recognition.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += text;
        else interim += text;
      }
      setTranscript(final || interim);
      if (final) {
        clearTimeout(timeout);
        recognition.stop();
        handleQuestion(final);
      }
    };

    recognition.onerror = (e) => {
      clearTimeout(timeout);
      if (e.error === 'no-speech') return;
      setIsListening(false);
      setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
      if (e.error === 'not-allowed') speak('Please allow microphone access.');
    };

    recognition.onend = () => {
      clearTimeout(timeout);
      setIsListening(false);
      if (!isProcessingRef.current) {
        setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
      }
    };

    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
    }
  }, [speak, handleQuestion]);

  // Initialize voices and clean up on unmount
  useEffect(() => {
    window.speechSynthesis.getVoices();
    return () => {
      visionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  // Space bar shortcut for voice questions
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !isListening && !isProcessing) {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isListening, isProcessing, startListening]);

  const statusVariant = isListening ? 'listening' : isProcessing ? 'processing' : isStreaming ? 'streaming' : 'ready';

  const efficiencyPct = metrics.framesProcessed > 0
    ? Math.round((metrics.newDescriptions / metrics.framesProcessed) * 100)
    : 0;

  return (
    <div className="demo">
      <div className="demo__container">

        {/* Camera preview */}
        <motion.div
          className="demo__camera"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          aria-hidden="true"
        >
          <video ref={videoRef} autoPlay playsInline muted className="demo__video" />
          <div className="demo__camera-label">
            <span className={`demo__camera-dot ${!isStreaming ? 'demo__camera-dot--off' : ''}`} />
            {isStreaming ? 'STREAMING' : 'OFFLINE'}
          </div>
        </motion.div>

        {/* Error banner */}
        {error && (
          <div className="demo__error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="demo__error-dismiss">×</button>
          </div>
        )}

        {/* Status bar */}
        <div className="demo__status" aria-live="polite" aria-atomic="true">
          <div className={`demo__status-dot demo__status-dot--${statusVariant}`} />
          <span className="demo__status-text">{currentStatus}</span>
        </div>

        {/* Start / Stop streaming */}
        <motion.button
          className={`demo__stream-btn ${isStreaming ? 'demo__stream-btn--active' : ''}`}
          onClick={isStreaming ? stopStreaming : startStreaming}
          aria-label={isStreaming ? 'Stop streaming' : 'Start continuous streaming'}
          whileTap={{ scale: 0.95 }}
        >
          <span className="demo__stream-icon">{isStreaming ? '⬛' : '▶'}</span>
          <span className="demo__stream-label">{isStreaming ? 'Stop Streaming' : 'Start Streaming'}</span>
        </motion.button>

        {/* Voice question button — only visible while streaming */}
        {isStreaming && (
          <motion.button
            className={`demo__speak-btn ${isListening ? 'demo__speak-btn--listening' : ''} ${isProcessing ? 'demo__speak-btn--processing' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!isListening && !isProcessing) startListening();
            }}
            aria-label="Ask a question about the scene"
            whileTap={{ scale: 0.95 }}
          >
            {isListening ? (
              <>
                <div className="demo__pulse-ring" />
                <span className="demo__mic-icon">🎤</span>
                <span className="demo__btn-label">Listening...</span>
              </>
            ) : isProcessing ? (
              <>
                <div className="demo__spinner" />
                <span className="demo__btn-label">Thinking</span>
              </>
            ) : (
              <>
                <span className="demo__mic-icon">🎤</span>
                <span className="demo__btn-label">Ask</span>
                <span className="demo__btn-hint">or Space</span>
              </>
            )}
          </motion.button>
        )}

        {/* Transcript */}
        {transcript && (
          <motion.div className="demo__transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__transcript-label">YOU SAID</span>
            <p className="demo__transcript-text">"{transcript}"</p>
          </motion.div>
        )}

        {/* Latest description or response */}
        {lastResponse && (
          <motion.div className="demo__response" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__response-label">DESCRIPTION</span>
            <p className="demo__response-text">{lastResponse}</p>
          </motion.div>
        )}

        {/* Scene memory */}
        <div className="demo__memory">
          <div className="demo__memory-header">
            <span className="demo__memory-icon">🧠</span>
            <span className="demo__memory-title">MEMORY</span>
          </div>
          {sceneMemory ? (
            <p className="demo__memory-content">{sceneMemory}</p>
          ) : (
            <p className="demo__memory-empty">
              {isStreaming ? 'Waiting for first scene...' : 'Start streaming to build scene memory.'}
            </p>
          )}
        </div>

        {/* Metrics — shown only after stream starts */}
        {metrics.sessionStart && (
          <div className="demo__metrics">
            <span className="demo__metrics-title">STREAM METRICS</span>
            <div className="demo__metrics-grid">
              <div className="demo__metric">
                <span className="demo__metric-value">{metrics.framesProcessed}</span>
                <span className="demo__metric-label">Frames analyzed</span>
              </div>
              <div className="demo__metric">
                <span className="demo__metric-value">{metrics.newDescriptions}</span>
                <span className="demo__metric-label">New descriptions</span>
              </div>
              <div className="demo__metric">
                <span className="demo__metric-value">{efficiencyPct}%</span>
                <span className="demo__metric-label">Scene change rate</span>
              </div>
            </div>
          </div>
        )}

        {/* Help text */}
        <div className="demo__help">
          <span className="demo__help-title">
            {isStreaming ? 'STREAMING — TAP MIC OR SPACE TO ASK' : 'PRESS START TO BEGIN STREAMING'}
          </span>
          {isStreaming && (
            <div className="demo__help-items">
              <span className="demo__help-item">"Is the path clear?"</span>
              <span className="demo__help-item">"What's on my left?"</span>
              <span className="demo__help-item">"Where is the door?"</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
