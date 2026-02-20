import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const FRAME_PROMPT = 'Describe what you see for a blind person navigating. Focus on: obstacles and hazards first, then clear paths, then spatial layout. Use clock positions. Under 3 sentences.';

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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Refs avoid stale closure issues in async callbacks
  const isStreamingRef = useRef(false);
  const lastDescriptionRef = useRef('');
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isAnalyzingRef = useRef(false);

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

  const captureFrameImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    // Lower quality for streaming — reduces payload and cost
    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  // Collect a full SSE response into a string
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
    speak('Streaming started. I will describe your surroundings as they change.', true);

    intervalRef.current = setInterval(async () => {
      // Skip if already talking, handling a question, or mid-analysis
      if (isSpeakingRef.current || isProcessingRef.current || isAnalyzingRef.current) return;

      const image = captureFrameImage();
      if (!image) return;

      isAnalyzingRef.current = true;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: FRAME_PROMPT, image })
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

        if (!isSpeakingRef.current && !isProcessingRef.current) {
          isSpeakingRef.current = true;
          speak(description).then(() => { isSpeakingRef.current = false; });
        }
      } catch (err) {
        console.error('[Frame error]', err.message);
      } finally {
        isAnalyzingRef.current = false;
      }
    }, 2000);
  }, [speak, captureFrameImage]);

  const stopStreaming = useCallback(async () => {
    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    isStreamingRef.current = false;
    isAnalyzingRef.current = false;
    setIsStreaming(false);
    setCurrentStatus('Stopped');
    speak('Streaming stopped.', true);
  }, [speak]);

  // Voice Q&A while streaming — calls /api/chat with current scene memory
  const generateResponse = useCallback(async (userMessage) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        sceneContext: sceneMemory,
        conversationHistory
      })
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

  useEffect(() => {
    window.speechSynthesis.getVoices();
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
    };
  }, []);

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
      {/* Hidden canvas used for frame capture */}
      <canvas ref={canvasRef} className="demo__canvas" />

      <div className="demo__container">

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

        {error && (
          <div className="demo__error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="demo__error-dismiss">×</button>
          </div>
        )}

        <div className="demo__status" aria-live="polite" aria-atomic="true">
          <div className={`demo__status-dot demo__status-dot--${statusVariant}`} />
          <span className="demo__status-text">{currentStatus}</span>
        </div>

        <motion.button
          className={`demo__stream-btn ${isStreaming ? 'demo__stream-btn--active' : ''}`}
          onClick={isStreaming ? stopStreaming : startStreaming}
          aria-label={isStreaming ? 'Stop streaming' : 'Start continuous streaming'}
          whileTap={{ scale: 0.95 }}
        >
          <span className="demo__stream-icon">{isStreaming ? '⬛' : '▶'}</span>
          <span className="demo__stream-label">{isStreaming ? 'Stop Streaming' : 'Start Streaming'}</span>
        </motion.button>

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
