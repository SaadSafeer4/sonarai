import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

export default function Demo() {
  const [sceneMemory, setSceneMemory] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready to listen');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [cameraReady]);

  const analyzeScene = useCallback(async (imageData) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    setSceneMemory(data.description);
    return data.description;
  }, []);

  const generateResponse = useCallback(async (userMessage, sceneDescription = null) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        sceneContext: sceneDescription || sceneMemory,
        conversationHistory
      })
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    
    setConversationHistory(prev => [
      ...prev.slice(-6),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: data.response }
    ]);
    return data.response;
  }, [sceneMemory, conversationHistory]);

  const processUserInput = useCallback(async (spokenText) => {
    setIsProcessing(true);
    setCurrentStatus('Processing...');
    
    const lower = spokenText.toLowerCase();
    const needsCapture = ['around', 'where am i', 'describe', 'see', 'look', 'scan', 'front', 'surround']
      .some(word => lower.includes(word));
    
    try {
      let response;
      
      if (needsCapture) {
        if (!cameraReady) {
          response = "Camera is not available. Please allow camera access and refresh the page.";
        } else {
          await speak('Let me take a look.', true);
          setCurrentStatus('Capturing...');
          
          const image = captureImage();
          if (!image) {
            response = "Could not capture image. Make sure camera is working.";
          } else {
            setCurrentStatus('Analyzing...');
            const scene = await analyzeScene(image);
            
            setCurrentStatus('Thinking...');
            response = await generateResponse(spokenText, scene);
          }
        }
      } else if (sceneMemory) {
        setCurrentStatus('Thinking...');
        response = await generateResponse(spokenText);
      } else {
        response = "I don't have any scene in memory yet. Try asking 'What's around me?'";
      }
      
      setLastResponse(response);
      setCurrentStatus('Speaking...');
      await speak(response, true);
      setCurrentStatus('Ready to listen');
    } catch (err) {
      console.error(err);
      let msg = "Sorry, something went wrong. Please try again.";
      if (err.message?.includes('API error')) {
        msg = "Could not connect to the AI. Check your internet connection.";
      }
      await speak(msg, true);
      setLastResponse(msg);
      setCurrentStatus('Ready to listen');
    } finally {
      setIsProcessing(false);
    }
  }, [captureImage, analyzeScene, generateResponse, sceneMemory, speak]);

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
      if (e.error === 'not-allowed') {
        speak('Please allow microphone access.');
      }
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
      if (e.code === 'Space' && !isListening && !isProcessing) {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isListening, isProcessing, startListening]);

  const status = isListening ? 'listening' : isProcessing ? 'processing' : 'ready';

  return (
    <div className="demo">
      <canvas ref={canvasRef} className="demo__canvas" />
      
      <div className="demo__container">
        <motion.div 
          className="demo__camera"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <video ref={videoRef} autoPlay playsInline muted className="demo__video" />
          <div className="demo__camera-label">
            <span className={`demo__camera-dot ${!cameraReady ? 'demo__camera-dot--off' : ''}`} />
            {cameraReady ? 'LIVE' : 'NO CAMERA'}
          </div>
        </motion.div>

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
