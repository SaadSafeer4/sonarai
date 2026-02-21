import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

// Very short frame prompt — forces one punchy sentence so TTS finishes before scene changes
const FRAME_PROMPT = 'One sentence only, max 12 words: hazards first, then path, then key objects. Clock positions.';
const FRAME_MAX_TOKENS = 60;

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
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [sceneMemory, setSceneMemory] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [metrics, setMetrics] = useState({ framesProcessed: 0, newDescriptions: 0, sessionStart: null });
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Stable refs — avoid stale closures in async callbacks and wake listener
  const isStreamingRef = useRef(false);
  const lastDescriptionRef = useRef('');
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isAnalyzingRef = useRef(false);
  const voiceMutedRef = useRef(false);
  const isListeningActiveRef = useRef(false); // true while manual mic is open

  // Refs to latest versions of functions — lets wake listener call them without stale closures
  const handleQuestionRef = useRef(null);
  const startWakeListenerRef = useRef(null);
  const wakeRecRef = useRef(null);
  const wakeRestartTimerRef = useRef(null);

  // ─── TTS helper ──────────────────────────────────────────────────────────────

  const getVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    const english = voices.filter(v => v.lang.startsWith('en'));
    return english.find(v =>
      v.name.includes('Google US') ||
      v.name.includes('Zira') ||
      v.name.includes('Samantha')
    ) || english[0] || voices[0];
  }, []);

  const speak = useCallback((text, priority = false) => {
    return new Promise((resolve) => {
      if (priority) window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.0;
      utt.lang = 'en-US';
      const v = getVoice();
      if (v) utt.voice = v;
      utt.onend = resolve;
      utt.onerror = resolve;
      window.speechSynthesis.speak(utt);
    });
  }, [getVoice]);

  // ─── Camera / frame capture ───────────────────────────────────────────────────

  const captureFrameImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.5); // low quality = smaller payload
  }, []);

  // ─── SSE collector ────────────────────────────────────────────────────────────

  const collectSSE = async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.text) text += d.text;
        } catch {}
      }
    }
    return text;
  };

  // ─── Wake word listener ───────────────────────────────────────────────────────
  // Runs continuously while streaming. Listens for "Hey Sonar [command]".
  // Commands: "turn voice off" / "mute" → silence scene TTS
  //           "turn voice on" / "unmute" → resume scene TTS
  //           anything else → treated as a question to the AI

  const startWakeListener = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !isStreamingRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      // Ignore results while TTS is speaking — avoids echo feedback loop
      if (window.speechSynthesis.speaking) return;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.toLowerCase().trim();

        // Must start with wake word
        if (!/(hey|okay|ok)\s+son[ao]r/i.test(text)) continue;

        // Extract the command portion after the wake word
        const command = text.replace(/(hey|okay|ok)\s+son[ao]r[,.\s]*/i, '').trim();

        console.log('[Wake] command:', command || '(empty)');

        if (/(voice|audio|sound)\s+off|^mute$|be\s+quiet|stop\s+talk/i.test(command)) {
          // Mute scene TTS — question responses still speak
          voiceMutedRef.current = true;
          setVoiceMuted(true);
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
          // Tiny ack before going silent
          const u = new SpeechSynthesisUtterance('Muted.');
          if (getVoice()) u.voice = getVoice();
          window.speechSynthesis.speak(u);

        } else if (/(voice|audio|sound)\s+on|^unmute$|start\s+talk/i.test(command)) {
          voiceMutedRef.current = false;
          setVoiceMuted(false);
          speak('Voice on.', true);

        } else if (!command) {
          // Just "Hey Sonar" with nothing after — acknowledge
          if (!voiceMutedRef.current) speak('Yes?', true);

        } else if (!isProcessingRef.current) {
          // Any other phrase → treat as a question
          setTranscript(command);
          handleQuestionRef.current?.(command);
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      console.warn('[Wake listener error]', e.error);
    };

    rec.onend = () => {
      // Auto-restart as long as streaming is active and manual mic isn't open
      if (isStreamingRef.current && !isListeningActiveRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = setTimeout(() => {
          startWakeListenerRef.current?.();
        }, 300);
      }
    };

    wakeRecRef.current = rec;
    try { rec.start(); } catch (e) { console.warn('[Wake start error]', e.message); }
  }, [speak, getVoice]); // handleQuestion accessed via ref — no stale closure

  const stopWakeListener = useCallback(() => {
    clearTimeout(wakeRestartTimerRef.current);
    if (wakeRecRef.current) {
      try { wakeRecRef.current.abort(); } catch (e) {}
      wakeRecRef.current = null;
    }
  }, []);

  // Keep function refs always pointing to latest version
  useEffect(() => { startWakeListenerRef.current = startWakeListener; }, [startWakeListener]);

  // ─── Streaming start / stop ───────────────────────────────────────────────────

  const startStreaming = useCallback(async () => {
    setError(null);
    setCurrentStatus('Connecting...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError('Camera not available: ' + err.message);
      setCurrentStatus('Ready');
      return;
    }

    isStreamingRef.current = true;
    setIsStreaming(true);
    setCurrentStatus('Streaming...');
    setMetrics({ framesProcessed: 0, newDescriptions: 0, sessionStart: Date.now() });
    speak('Streaming started. Say Hey Sonar to ask questions or control voice.', true);

    intervalRef.current = setInterval(async () => {
      // Only skip if handling a question or already mid-analysis — allow captures while speaking
      if (isProcessingRef.current || isAnalyzingRef.current) return;

      const image = captureFrameImage();
      if (!image) return;

      isAnalyzingRef.current = true;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: FRAME_PROMPT, image, maxTokens: FRAME_MAX_TOKENS })
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const description = await collectSSE(res);
        if (!description.trim()) return;

        setMetrics(prev => ({ ...prev, framesProcessed: prev.framesProcessed + 1 }));

        // Skip if scene hasn't changed meaningfully (>75% word overlap)
        if (wordSimilarity(description, lastDescriptionRef.current) > 0.75) return;

        lastDescriptionRef.current = description;
        setSceneMemory(description);
        setLastResponse(description);
        setMetrics(prev => ({ ...prev, newDescriptions: prev.newDescriptions + 1 }));

        // Cancel stale TTS and speak new scene — unless muted or handling a question
        if (!isProcessingRef.current && !voiceMutedRef.current) {
          window.speechSynthesis.cancel();
          isSpeakingRef.current = true;
          speak(description).then(() => { isSpeakingRef.current = false; });
        }
      } catch (err) {
        console.error('[Frame error]', err.message);
      } finally {
        isAnalyzingRef.current = false;
      }
    }, 2000);

    // Start wake listener after TTS intro finishes (~2s delay)
    setTimeout(() => startWakeListenerRef.current?.(), 2000);
  }, [speak, captureFrameImage]);

  const stopStreaming = useCallback(async () => {
    window.speechSynthesis.cancel();
    stopWakeListener();
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    isStreamingRef.current = false;
    isAnalyzingRef.current = false;
    isSpeakingRef.current = false;
    setIsStreaming(false);
    setCurrentStatus('Stopped');
    speak('Streaming stopped.', true);
  }, [speak, stopWakeListener]);

  // ─── Voice Q&A ────────────────────────────────────────────────────────────────

  const generateResponse = useCallback(async (userMessage) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, sceneContext: sceneMemory, conversationHistory })
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const text = await collectSSE(res);
    setConversationHistory(prev => [
      ...prev.slice(-6),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: text }
    ]);
    return text;
  }, [sceneMemory, conversationHistory]);

  const handleQuestion = useCallback(async (question) => {
    isProcessingRef.current = true;
    setIsProcessing(true);
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    try {
      const response = await generateResponse(question);
      setLastResponse(response);
      await speak(response, true); // question responses always speak, ignoring voiceMuted
    } catch (err) {
      await speak('Sorry, could not answer that.', true);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      if (isStreamingRef.current) setCurrentStatus('Streaming...');
    }
  }, [generateResponse, speak]);

  // Keep handleQuestion ref fresh
  useEffect(() => { handleQuestionRef.current = handleQuestion; }, [handleQuestion]);

  // ─── Manual mic (button / Space) ─────────────────────────────────────────────

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { speak('Speech recognition not supported. Try Chrome.'); return; }

    // Pause wake listener to avoid two recognition instances conflicting
    isListeningActiveRef.current = true;
    stopWakeListener();

    setIsListening(true);
    setTranscript('');
    setCurrentStatus('Listening...');

    // Beep feedback
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    const timeout = setTimeout(() => rec.stop(), 10000);

    rec.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setTranscript(final || interim);
      if (final) { clearTimeout(timeout); rec.stop(); handleQuestion(final); }
    };

    rec.onerror = (e) => {
      clearTimeout(timeout);
      if (e.error === 'no-speech') return;
      setIsListening(false);
      isListeningActiveRef.current = false;
      setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
      if (e.error === 'not-allowed') speak('Please allow microphone access.');
      if (isStreamingRef.current) setTimeout(() => startWakeListenerRef.current?.(), 300);
    };

    rec.onend = () => {
      clearTimeout(timeout);
      setIsListening(false);
      isListeningActiveRef.current = false;
      if (!isProcessingRef.current) setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
      // Restart wake listener after manual mic closes
      if (isStreamingRef.current) setTimeout(() => startWakeListenerRef.current?.(), 300);
    };

    try { rec.start(); } catch (err) {
      setIsListening(false);
      isListeningActiveRef.current = false;
      setCurrentStatus(isStreamingRef.current ? 'Streaming...' : 'Ready');
    }
  }, [speak, handleQuestion, stopWakeListener]);

  // ─── Mute toggle (visual button) ─────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const newMuted = !voiceMutedRef.current;
    voiceMutedRef.current = newMuted;
    setVoiceMuted(newMuted);
    if (newMuted) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    } else {
      speak('Voice on.', true);
    }
  }, [speak]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  useEffect(() => {
    window.speechSynthesis.getVoices();
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(wakeRestartTimerRef.current);
      stopWakeListener();
      streamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
    };
  }, [stopWakeListener]);

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

  // ─── Render ───────────────────────────────────────────────────────────────────

  const statusVariant = isListening ? 'listening' : isProcessing ? 'processing' : isStreaming ? 'streaming' : 'ready';
  const efficiencyPct = metrics.framesProcessed > 0
    ? Math.round((metrics.newDescriptions / metrics.framesProcessed) * 100) : 0;

  return (
    <div className="demo">
      <canvas ref={canvasRef} className="demo__canvas" />

      <div className="demo__container">

        {/* Camera preview */}
        <motion.div className="demo__camera" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} aria-hidden="true">
          <video ref={videoRef} autoPlay playsInline muted className="demo__video" />
          <div className="demo__camera-label">
            <span className={`demo__camera-dot ${!isStreaming ? 'demo__camera-dot--off' : ''}`} />
            {isStreaming ? (voiceMuted ? 'STREAMING (MUTED)' : 'STREAMING') : 'OFFLINE'}
          </div>
        </motion.div>

        {error && (
          <div className="demo__error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="demo__error-dismiss">×</button>
          </div>
        )}

        <div className="demo__status" aria-live="polite" aria-atomic="true">
          <div className={`demo__status-dot demo__status-dot--${statusVariant}`} />
          <span className="demo__status-text">{currentStatus}</span>
        </div>

        {/* Start / Stop */}
        <motion.button
          className={`demo__stream-btn ${isStreaming ? 'demo__stream-btn--active' : ''}`}
          onClick={isStreaming ? stopStreaming : startStreaming}
          aria-label={isStreaming ? 'Stop streaming' : 'Start continuous streaming'}
          whileTap={{ scale: 0.95 }}
        >
          <span className="demo__stream-icon">{isStreaming ? '⬛' : '▶'}</span>
          <span className="demo__stream-label">{isStreaming ? 'Stop Streaming' : 'Start Streaming'}</span>
        </motion.button>

        {/* Mute toggle — shown while streaming */}
        {isStreaming && (
          <motion.button
            onClick={toggleMute}
            aria-label={voiceMuted ? 'Unmute voice' : 'Mute voice'}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1.2rem', borderRadius: '999px', border: 'none',
              background: voiceMuted ? '#ff4444' : '#333', color: '#fff',
              cursor: 'pointer', fontSize: '0.9rem', margin: '0.5rem auto'
            }}
          >
            <span>{voiceMuted ? '🔇' : '🔊'}</span>
            <span>{voiceMuted ? 'Unmute' : 'Mute'}</span>
          </motion.button>
        )}

        {/* Manual mic button — shown while streaming */}
        {isStreaming && (
          <motion.button
            className={`demo__speak-btn ${isListening ? 'demo__speak-btn--listening' : ''} ${isProcessing ? 'demo__speak-btn--processing' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); if (!isListening && !isProcessing) startListening(); }}
            aria-label="Ask a question"
            whileTap={{ scale: 0.95 }}
          >
            {isListening ? (
              <><div className="demo__pulse-ring" /><span className="demo__mic-icon">🎤</span><span className="demo__btn-label">Listening...</span></>
            ) : isProcessing ? (
              <><div className="demo__spinner" /><span className="demo__btn-label">Thinking</span></>
            ) : (
              <><span className="demo__mic-icon">🎤</span><span className="demo__btn-label">Ask</span><span className="demo__btn-hint">or Space</span></>
            )}
          </motion.button>
        )}

        {transcript && (
          <motion.div className="demo__transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__transcript-label">YOU SAID</span>
            <p className="demo__transcript-text">"{transcript}"</p>
          </motion.div>
        )}

        {lastResponse && (
          <motion.div className="demo__response" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__response-label">DESCRIPTION</span>
            <p className="demo__response-text">{lastResponse}</p>
          </motion.div>
        )}

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

        <div className="demo__help">
          <span className="demo__help-title">
            {isStreaming ? 'SAY "HEY SONAR" OR TAP MIC TO ASK' : 'PRESS START TO BEGIN STREAMING'}
          </span>
          {isStreaming && (
            <div className="demo__help-items">
              <span className="demo__help-item">"Hey Sonar, is the path clear?"</span>
              <span className="demo__help-item">"Hey Sonar, turn voice off"</span>
              <span className="demo__help-item">"Hey Sonar, turn voice on"</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
