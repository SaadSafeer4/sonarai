import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ModeToggle from '../components/ModeToggle';
import StreamingMode from '../components/StreamingMode';

// Stock sample media (images via Unsplash CDN with CORS support, videos via Pexels)
const SAMPLES = [
  {
    id: 'kitchen',
    type: 'image',
    label: 'Kitchen',
    url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=640&q=80',
    thumb: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=60',
  },
  {
    id: 'living-room',
    type: 'image',
    label: 'Living Room',
    url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=640&q=80',
    thumb: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&q=60',
  },
  {
    id: 'street',
    type: 'image',
    label: 'City Street',
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=640&q=80',
    thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&q=60',
  },
  {
    id: 'grocery',
    type: 'image',
    label: 'Grocery Store',
    url: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=640&q=80',
    thumb: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200&q=60',
  },
  {
    id: 'park-walk',
    type: 'video',
    label: 'Park Walk',
    url: 'https://videos.pexels.com/video-files/1390942/1390942-sd_960_540_25fps.mp4',
    thumb: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=200&q=60',
  },
  {
    id: 'market',
    type: 'video',
    label: 'Busy Market',
    url: 'https://videos.pexels.com/video-files/2499611/2499611-sd_960_540_30fps.mp4',
    thumb: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=60',
  },
];

export default function Demo() {
  const [mode, setMode] = useState('traditional');

  // Traditional mode state
  const [sceneMemory, setSceneMemory] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready to listen');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  const [selectedSample, setSelectedSample] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const sampleImageDataRef = useRef(null); // stores base64 for selected sample image

  // Speak a single utterance and await completion (for one-off messages)
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

  const initializeCamera = useCallback(async () => {
    try {
      // Clear any sample source before attaching camera stream
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.poster = '';
        videoRef.current.loop = false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setCameraReady(true);
    } catch (err) {
      console.warn('Camera not available:', err.message);
      setCameraReady(false);
    }
  }, []);

  const captureImage = useCallback(() => {
    // Use pre-loaded sample image data when a photo sample is selected
    if (sampleImageDataRef.current) return sampleImageDataRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    try {
      canvas.getContext('2d').drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return null; // tainted canvas (CORS) — handled upstream
    }
  }, [cameraReady]);

  // Load a sample image or video into the viewport for testing
  const selectSample = useCallback((sample) => {
    setSelectedSample(sample.id);
    sampleImageDataRef.current = null;

    // Stop live camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (sample.type === 'image') {
      // Preload image onto hidden canvas to get base64 (requires CORS support from CDN)
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        try {
          sampleImageDataRef.current = canvas.toDataURL('image/jpeg', 0.8);
        } catch {
          console.warn('Could not preload sample image to canvas (CORS). Capture will be skipped.');
        }
      };
      img.src = sample.url;

      // Show image as poster in the video viewport
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.src = '';
        videoRef.current.poster = sample.url;
      }
      setCameraReady(true);
    } else if (sample.type === 'video') {
      // Load video into the video element — frame capture works the same way
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.crossOrigin = 'anonymous';
        videoRef.current.src = sample.url;
        videoRef.current.loop = true;
        videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    }
  }, []);

  const resetToCamera = useCallback(() => {
    setSelectedSample(null);
    sampleImageDataRef.current = null;
    initializeCamera();
  }, [initializeCamera]);

  // Queue a sentence to TTS without waiting — for streaming sentence-by-sentence playback
  const getPreferredVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    const english = voices.filter(v => v.lang.startsWith('en'));
    return english.find(v =>
      v.name.includes('Google US') ||
      v.name.includes('Zira') ||
      v.name.includes('Samantha')
    ) || english[0] || voices[0];
  }, []);

  const speakQueued = useCallback((text) => {
    if (!text.trim()) return;
    const utt = new SpeechSynthesisUtterance(text.trim());
    utt.rate = 1.0;
    utt.lang = 'en-US';
    const voice = getPreferredVoice();
    if (voice) utt.voice = voice;
    window.speechSynthesis.speak(utt);
  }, [getPreferredVoice]);

  // Stream response from /api/chat, speaking sentences as they arrive
  const streamResponse = useCallback(async (userMessage, image = null) => {
    window.speechSynthesis.cancel();

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        image,
        sceneContext: image ? null : sceneMemory,
        conversationHistory
      })
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    // Flush complete sentences from buffer to TTS queue
    const flush = (final = false) => {
      if (final) {
        if (buffer.trim()) speakQueued(buffer.trim());
        buffer = '';
        return;
      }
      // Only speak a sentence when followed by whitespace (avoids cutting mid-sentence)
      let idx;
      while ((idx = buffer.search(/[.!?]\s/)) !== -1) {
        speakQueued(buffer.slice(0, idx + 1));
        buffer = buffer.slice(idx + 1).trimStart();
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.text) { fullText += d.text; buffer += d.text; flush(); }
          if (d.done) flush(true);
        } catch {}
      }
    }
    flush(true);

    // Update scene memory if this was a visual query
    if (image) setSceneMemory(fullText);

    setConversationHistory(prev => [
      ...prev.slice(-6),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: fullText }
    ]);

    return fullText;
  }, [sceneMemory, conversationHistory, speakQueued]);

  const processUserInput = useCallback(async (spokenText) => {
    setIsProcessing(true);
    setCurrentStatus('Processing...');

    const lower = spokenText.toLowerCase();
    const needsCapture = ['around', 'where am i', 'describe', 'see', 'look', 'scan', 'front', 'surround']
      .some(word => lower.includes(word));

    try {
      // Guard: no scene and no visual query
      if (!needsCapture && !sceneMemory) {
        const msg = "I don't have any scene in memory yet. Try asking 'What's around me?'";
        setLastResponse(msg);
        await speak(msg, true);
        setCurrentStatus('Ready to listen');
        return;
      }

      let image = null;
      if (needsCapture) {
        if (!cameraReady) {
          const msg = 'Camera is not available. Please allow camera access and refresh.';
          setLastResponse(msg);
          await speak(msg, true);
          setCurrentStatus('Ready to listen');
          return;
        }
        setCurrentStatus('Capturing...');
        image = captureImage();
      }

      setCurrentStatus('Thinking...');
      const response = await streamResponse(spokenText, image);
      setLastResponse(response);

      // Wait for the TTS queue to drain before accepting next input
      setCurrentStatus('Speaking...');
      await new Promise(resolve => {
        const poll = setInterval(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(poll); resolve(); }, 15000);
      });

      setCurrentStatus('Ready to listen');
    } catch (err) {
      console.error(err);
      window.speechSynthesis.cancel();
      const msg = err.message?.includes('API')
        ? 'Could not connect to AI. Check your connection.'
        : 'Sorry, something went wrong. Please try again.';
      setLastResponse(msg);
      await speak(msg, true);
      setCurrentStatus('Ready to listen');
    } finally {
      setIsProcessing(false);
    }
  }, [captureImage, streamResponse, sceneMemory, speak, cameraReady]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak('Speech recognition not supported. Try Chrome or Safari.');
      return;
    }

    setIsListening(true);
    setTranscript('');
    setCurrentStatus('Listening...');

    // Feedback beep
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
        processUserInput(final);
      }
    };

    recognition.onerror = (e) => {
      clearTimeout(timeout);
      if (e.error === 'no-speech') return;
      setIsListening(false);
      setCurrentStatus('Ready to listen');
      if (e.error === 'not-allowed') speak('Please allow microphone access.');
    };

    recognition.onend = () => {
      clearTimeout(timeout);
      setIsListening(false);
      if (!isProcessing) setCurrentStatus('Ready to listen');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setCurrentStatus('Ready to listen');
    }
  }, [speak, processUserInput, isProcessing]);

  useEffect(() => {
    window.speechSynthesis.getVoices();
    initializeCamera();
    setTimeout(() => speak('SonarAI ready. Tap the button and ask: What\'s around me?'), 1000);
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [initializeCamera, speak]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !isListening && !isProcessing && mode === 'traditional') {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isListening, isProcessing, startListening, mode]);

  const status = isListening ? 'listening' : isProcessing ? 'processing' : 'ready';

  if (mode === 'streaming') {
    return (
      <>
        <div className="demo__mode-wrapper">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        <StreamingMode />
      </>
    );
  }

  return (
    <div className="demo">
      <canvas ref={canvasRef} className="demo__canvas" />

      <div className="demo__container">
        <ModeToggle mode={mode} onChange={setMode} />

        <motion.div
          className="demo__camera"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <video ref={videoRef} autoPlay playsInline muted className="demo__video" />
          <div className="demo__camera-label">
            <span className={`demo__camera-dot ${!cameraReady ? 'demo__camera-dot--off' : ''}`} />
            {selectedSample ? 'SAMPLE' : cameraReady ? 'LIVE' : 'NO CAMERA'}
          </div>
        </motion.div>

        {/* Sample media picker */}
        <div className="demo__samples">
          <span className="demo__samples-title">No camera? Try an example</span>
          <div className="demo__samples-grid">
            {SAMPLES.map(sample => (
              <motion.button
                key={sample.id}
                className={`demo__sample-item ${selectedSample === sample.id ? 'demo__sample-item--active' : ''}`}
                onClick={() => selectSample(sample)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                aria-label={`Use ${sample.label} as input`}
              >
                <div
                  className="demo__sample-thumb"
                  style={{ backgroundImage: `url(${sample.thumb})` }}
                >
                  {sample.type === 'video' && (
                    <div className="demo__sample-video-badge">▶</div>
                  )}
                </div>
                <span className="demo__sample-label">{sample.label}</span>
              </motion.button>
            ))}
          </div>
          <div className="demo__samples-footer">
            <span className="demo__samples-note">Photos by Unsplash · Videos by Pexels</span>
            {selectedSample && (
              <button className="demo__samples-reset" onClick={resetToCamera}>
                ← Use my camera
              </button>
            )}
          </div>
        </div>

        <div className="demo__status">
          <div className={`demo__status-dot demo__status-dot--${status}`} />
          <span className="demo__status-text">{currentStatus}</span>
        </div>

        <motion.button
          className={`demo__speak-btn ${isListening ? 'demo__speak-btn--listening' : ''} ${isProcessing ? 'demo__speak-btn--processing' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!isListening && !isProcessing) startListening();
          }}
          aria-label="Tap to speak"
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
              <span className="demo__btn-label">Processing</span>
            </>
          ) : (
            <>
              <span className="demo__mic-icon">🎤</span>
              <span className="demo__btn-label">Tap to Speak</span>
              <span className="demo__btn-hint">or press Space</span>
            </>
          )}
        </motion.button>

        {transcript && (
          <motion.div className="demo__transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__transcript-label">YOU SAID</span>
            <p className="demo__transcript-text">"{transcript}"</p>
          </motion.div>
        )}

        {lastResponse && (
          <motion.div className="demo__response" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="demo__response-label">RESPONSE</span>
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
            <p className="demo__memory-empty">No scene yet. Ask "What's around me?"</p>
          )}
        </div>

        <div className="demo__help">
          <span className="demo__help-title">TRY SAYING</span>
          <div className="demo__help-items">
            <span className="demo__help-item">"What's around me?"</span>
            <span className="demo__help-item">"Where was the chair?"</span>
            <span className="demo__help-item">"Tell me more"</span>
          </div>
        </div>
      </div>
    </div>
  );
}
