/**
 * VisionAI - Main Application Component
 * 
 * Core intelligence layer for a smart glasses accessibility product.
 * This MVP demonstrates:
 * 1. Voice input/output without screen dependency
 * 2. Webcam image capture and analysis
 * 3. SHORT-TERM MEMORY for follow-up questions
 * 
 * Differentiator: Stateful conversation across turns
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================
// WHERE SHORT-TERM MEMORY IS STORED
// These state variables persist scene context
// ============================================
const App = () => {
  // Scene memory - stores the last analyzed scene description
  const [sceneMemory, setSceneMemory] = useState(null);
  
  // Conversation history for multi-turn context
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // UI State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [debugLog, setDebugLog] = useState([]);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

  // Add to debug log
  const log = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-20), { timestamp, message, type }]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // ============================================
  // TEXT-TO-SPEECH - Voice Output
  // ============================================
  const speak = useCallback((text, priority = false) => {
    return new Promise((resolve) => {
      if (priority) {
        window.speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US'; // Force English
      
      // Try to find a good English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Prefer natural-sounding English voices
      const preferredVoice = englishVoices.find(v => 
        v.name.includes('Google US') || 
        v.name.includes('Microsoft Zira') ||
        v.name.includes('Microsoft David') ||
        v.name.includes('Samantha') ||
        v.name.includes('Natural')
      ) || englishVoices.find(v => 
        v.name.includes('Google')
      ) || englishVoices[0] || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        log(`Using voice: ${preferredVoice.name}`, 'info');
      }
      
      utterance.onend = resolve;
      utterance.onerror = resolve;
      
      window.speechSynthesis.speak(utterance);
      log(`Speaking: "${text.substring(0, 50)}..."`, 'speech');
    });
  }, [log]);

  // ============================================
  // WEBCAM INITIALIZATION
  // ============================================
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Prefer rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      
      log('Camera initialized', 'success');
      return true;
    } catch (error) {
      log(`Camera error: ${error.message}`, 'error');
      await speak('Could not access camera. Please allow camera permissions.');
      return false;
    }
  }, [log, speak]);

  // ============================================
  // WHERE THE WEBCAM IMAGE IS CAPTURED
  // ============================================
  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      log('Video or canvas not ready', 'error');
      return null;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64 JPEG
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    log('Image captured from webcam', 'success');
    
    return imageData;
  }, [log]);

  // ============================================
  // VISION API CALL
  // Sends image to backend for Gemini Vision analysis
  // ============================================
  const analyzeScene = useCallback(async (imageData) => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // ============================================
      // STORING SCENE IN SHORT-TERM MEMORY
      // This enables follow-up questions about the scene
      // ============================================
      setSceneMemory(data.description);
      log(`Scene memory updated: "${data.description.substring(0, 80)}..."`, 'memory');
      
      return data.description;
    } catch (error) {
      log(`Vision API error: ${error.message}`, 'error');
      throw error;
    }
  }, [log]);

  // ============================================
  // CHAT API CALL
  // Generates conversational response with scene context
  // ============================================
  const generateResponse = useCallback(async (userMessage, sceneDescription = null) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          // ============================================
          // PASSING SHORT-TERM MEMORY TO CHAT API
          // ============================================
          sceneContext: sceneDescription || sceneMemory,
          conversationHistory
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update conversation history
      setConversationHistory(prev => [
        ...prev.slice(-6), // Keep last 3 exchanges
        { role: 'user', content: userMessage },
        { role: 'assistant', content: data.response }
      ]);
      
      return data.response;
    } catch (error) {
      log(`Chat API error: ${error.message}`, 'error');
      throw error;
    }
  }, [sceneMemory, conversationHistory, log]);

  // ============================================
  // MAIN PROCESSING FLOW
  // Determines if we need to capture new image or use memory
  // ============================================
  const processUserInput = useCallback(async (spokenText) => {
    setIsProcessing(true);
    setCurrentStatus('Processing...');
    
    const lowerText = spokenText.toLowerCase();
    
    // Check if user is asking about surroundings (needs new image)
    const needsNewCapture = 
      lowerText.includes("what's around") ||
      lowerText.includes("what is around") ||
      lowerText.includes("where am i") ||
      lowerText.includes("describe") ||
      lowerText.includes("what do you see") ||
      lowerText.includes("look around") ||
      lowerText.includes("scan") ||
      lowerText.includes("what's in front") ||
      lowerText.includes("what is in front") ||
      lowerText.includes("surroundings");
    
    try {
      let response;
      
      if (needsNewCapture) {
        // Capture and analyze new scene
        await speak('Let me take a look.', true);
        setCurrentStatus('Capturing image...');
        
        const imageData = captureImage();
        if (!imageData) {
          throw new Error('Failed to capture image');
        }
        
        setCurrentStatus('Analyzing scene...');
        const sceneDescription = await analyzeScene(imageData);
        
        setCurrentStatus('Generating response...');
        response = await generateResponse(spokenText, sceneDescription);
      } else {
        // ============================================
        // USING SHORT-TERM MEMORY FOR FOLLOW-UP
        // This is the key differentiator!
        // ============================================
        if (sceneMemory) {
          log('Using scene memory for follow-up question', 'memory');
          setCurrentStatus('Thinking...');
          response = await generateResponse(spokenText);
        } else {
          response = "I don't have any scene in memory yet. Try asking me 'What's around me?' and I'll capture and describe your surroundings.";
        }
      }
      
      setLastResponse(response);
      setCurrentStatus('Speaking...');
      await speak(response, true);
      setCurrentStatus('Ready');
      
    } catch (error) {
      const errorMsg = "I'm sorry, something went wrong. Please try again.";
      await speak(errorMsg, true);
      setLastResponse(errorMsg);
      setCurrentStatus('Ready');
    } finally {
      setIsProcessing(false);
    }
  }, [captureImage, analyzeScene, generateResponse, sceneMemory, speak, log]);

  // ============================================
  // SPEECH RECOGNITION - Voice Input
  // ============================================
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      speak('Speech recognition is not supported in this browser.');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setCurrentStatus('Listening...');
      log('Speech recognition started', 'speech');
      
      // Audio feedback - a soft "listening" sound
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.2);
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      setTranscript(finalTranscript || interimTranscript);
      
      if (finalTranscript) {
        log(`Final transcript: "${finalTranscript}"`, 'speech');
        recognition.stop();
        processUserInput(finalTranscript);
      }
    };
    
    recognition.onerror = (event) => {
      log(`Speech error: ${event.error}`, 'error');
      setIsListening(false);
      setCurrentStatus('Ready');
      
      if (event.error === 'no-speech') {
        speak("I didn't hear anything. Tap the button and try again.");
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      if (!isProcessing) {
        setCurrentStatus('Ready');
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [speak, processUserInput, isProcessing, log]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Load voices
      window.speechSynthesis.getVoices();
      
      // Initialize camera
      await initializeCamera();
      
      // Welcome message
      setTimeout(() => {
        speak('VisionAI ready. Tap anywhere and ask: What\'s around me?');
      }, 1000);
    };
    
    init();
    
    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeCamera, speak]);

  // Keyboard shortcut (Space bar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isListening && !isProcessing) {
        e.preventDefault();
        startListening();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, isProcessing, startListening]);

  return (
    <div className="app">
      {/* Hidden video and canvas for capture */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="hidden-video"
      />
      <canvas ref={canvasRef} className="hidden-canvas" />
      
      {/* Main UI - Optimized for accessibility */}
      <div className="container">
        {/* Status indicator */}
        <div className="status-bar">
          <div className={`status-dot ${isListening ? 'listening' : isProcessing ? 'processing' : 'ready'}`} />
          <span className="status-text">{currentStatus}</span>
        </div>
        
        {/* Large speak button - Main interaction */}
        <button
          className={`speak-button ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
          onClick={startListening}
          disabled={isListening || isProcessing}
          aria-label="Tap to speak"
        >
          <div className="button-content">
            {isListening ? (
              <>
                <div className="pulse-ring" />
                <div className="mic-icon listening">🎤</div>
                <span className="button-label">Listening...</span>
              </>
            ) : isProcessing ? (
              <>
                <div className="spinner" />
                <span className="button-label">Processing...</span>
              </>
            ) : (
              <>
                <div className="mic-icon">🎤</div>
                <span className="button-label">Tap to Speak</span>
                <span className="button-hint">or press Space</span>
              </>
            )}
          </div>
        </button>
        
        {/* Transcript display */}
        {transcript && (
          <div className="transcript-box">
            <span className="transcript-label">You said:</span>
            <p className="transcript-text">"{transcript}"</p>
          </div>
        )}
        
        {/* Response display */}
        {lastResponse && (
          <div className="response-box">
            <span className="response-label">Response:</span>
            <p className="response-text">{lastResponse}</p>
          </div>
        )}
        
        {/* Memory indicator - Shows differentiation feature */}
        <div className="memory-indicator">
          <div className="memory-header">
            <span className="memory-icon">🧠</span>
            <span className="memory-title">Short-Term Memory</span>
          </div>
          {sceneMemory ? (
            <p className="memory-content">{sceneMemory}</p>
          ) : (
            <p className="memory-empty">No scene captured yet</p>
          )}
        </div>
        
        {/* Debug panel (collapsed by default) */}
        <details className="debug-panel">
          <summary>Debug Log</summary>
          <div className="debug-log">
            {debugLog.map((entry, i) => (
              <div key={i} className={`log-entry ${entry.type}`}>
                <span className="log-time">{entry.timestamp}</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </details>
        
        {/* Footer */}
        <footer className="footer">
          <p>VisionAI MVP - Smart Glasses Intelligence Layer</p>
          <p className="footer-hint">Try: "What's around me?" then "Where was the [object]?"</p>
        </footer>
      </div>
    </div>
  );
};

export default App;

