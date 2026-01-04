/**
 * SonarAI Demo Page
 * 
 * The core accessibility demo:
 * - Voice input/output
 * - Webcam scene analysis
 * - Short-term memory for follow-ups
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const Demo = () => {
  // ============================================
  // SHORT-TERM MEMORY - Key differentiator
  // ============================================
  const [sceneMemory, setSceneMemory] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // UI State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready to listen');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

  // ============================================
  // TEXT-TO-SPEECH
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
      utterance.lang = 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const preferredVoice = englishVoices.find(v => 
        v.name.includes('Google US') || 
        v.name.includes('Microsoft Zira') ||
        v.name.includes('Microsoft David') ||
        v.name.includes('Samantha') ||
        v.name.includes('Natural')
      ) || englishVoices.find(v => v.name.includes('Google')) || englishVoices[0] || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.onend = resolve;
      utterance.onerror = resolve;
      
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ============================================
  // WEBCAM INITIALIZATION
  // ============================================
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      
      setCameraReady(true);
      return true;
    } catch (error) {
      console.warn('Camera not available:', error.message);
      setCameraReady(false);
      return false;
    }
  }, []);

  // ============================================
  // CAPTURE IMAGE FROM WEBCAM
  // ============================================
  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !cameraReady) {
      return null;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, [cameraReady]);

  // ============================================
  // VISION API CALL
  // ============================================
  const analyzeScene = useCallback(async (imageData) => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    setSceneMemory(data.description);
    return data.description;
  }, []);

  // ============================================
  // CHAT API CALL
  // ============================================
  const generateResponse = useCallback(async (userMessage, sceneDescription = null) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        sceneContext: sceneDescription || sceneMemory,
        conversationHistory
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    setConversationHistory(prev => [
      ...prev.slice(-6),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: data.response }
    ]);
    
    return data.response;
  }, [sceneMemory, conversationHistory]);

  // ============================================
  // MAIN PROCESSING FLOW
  // ============================================
  const processUserInput = useCallback(async (spokenText) => {
    setIsProcessing(true);
    setCurrentStatus('Processing...');
    
    const lowerText = spokenText.toLowerCase();
    
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
        await speak('Let me take a look.', true);
        setCurrentStatus('Capturing image...');
        
        const imageData = captureImage();
        if (!imageData) {
          throw new Error('Camera not available');
        }
        
        setCurrentStatus('Analyzing scene...');
        const sceneDescription = await analyzeScene(imageData);
        
        setCurrentStatus('Generating response...');
        response = await generateResponse(spokenText, sceneDescription);
      } else {
        if (sceneMemory) {
          setCurrentStatus('Thinking...');
          response = await generateResponse(spokenText);
        } else {
          response = "I don't have any scene in memory yet. Try asking me 'What's around me?' and I'll capture and describe your surroundings.";
        }
      }
      
      setLastResponse(response);
      setCurrentStatus('Speaking...');
      await speak(response, true);
      setCurrentStatus('Ready to listen');
      
    } catch (error) {
      const errorMsg = "I'm sorry, something went wrong. Please try again.";
      await speak(errorMsg, true);
      setLastResponse(errorMsg);
      setCurrentStatus('Ready to listen');
    } finally {
      setIsProcessing(false);
    }
  }, [captureImage, analyzeScene, generateResponse, sceneMemory, speak]);

  // ============================================
  // SPEECH RECOGNITION
  // ============================================
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      speak('Speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }
    
    setIsListening(true);
    setTranscript('');
    setCurrentStatus('Listening...');
    
    // Audio feedback
    try {
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
    } catch (e) {}
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    const timeoutId = setTimeout(() => {
      recognition.stop();
    }, 10000);
    
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
        clearTimeout(timeoutId);
        recognition.stop();
        processUserInput(finalTranscript);
      }
    };
    
    recognition.onerror = (event) => {
      clearTimeout(timeoutId);
      
      if (event.error === 'no-speech') {
        return;
      }
      
      setIsListening(false);
      setCurrentStatus('Ready to listen');
      
      if (event.error === 'not-allowed') {
        speak('Please allow microphone access in your browser settings.');
      }
    };
    
    recognition.onend = () => {
      clearTimeout(timeoutId);
      setIsListening(false);
      if (!isProcessing) {
        setCurrentStatus('Ready to listen');
      }
    };
    
    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setCurrentStatus('Ready to listen');
      speak('Could not start speech recognition. Please try again.');
    }
  }, [speak, processUserInput, isProcessing]);

  // Initialize
  useEffect(() => {
    window.speechSynthesis.getVoices();
    initializeCamera();
    
    setTimeout(() => {
      speak('SonarAI ready. Tap the button and ask: What\'s around me?');
    }, 1000);
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeCamera, speak]);

  // Keyboard shortcut
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
    <div className="demo">
      <canvas ref={canvasRef} className="demo__canvas" />
      
      <div className="demo__container">
        {/* Camera Preview */}
        <motion.div 
          className="demo__camera"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="demo__video"
          />
          <div className="demo__camera-label">
            <span className="demo__camera-dot" />
            LIVE CAMERA
          </div>
        </motion.div>

        {/* Status */}
        <motion.div 
          className="demo__status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className={`demo__status-dot demo__status-dot--${isListening ? 'listening' : isProcessing ? 'processing' : 'ready'}`} />
          <span className="demo__status-text">{currentStatus}</span>
        </motion.div>

        {/* Speak Button */}
        <motion.button
          className={`demo__speak-btn ${isListening ? 'demo__speak-btn--listening' : ''} ${isProcessing ? 'demo__speak-btn--processing' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!isListening && !isProcessing) {
              startListening();
            }
          }}
          aria-label="Tap to speak"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="demo__speak-btn-content">
            {isListening ? (
              <>
                <div className="demo__pulse-ring" />
                <span className="demo__mic-icon">🎤</span>
                <span className="demo__btn-label">Listening...</span>
              </>
            ) : isProcessing ? (
              <>
                <div className="demo__spinner" />
                <span className="demo__btn-label">Processing...</span>
              </>
            ) : (
              <>
                <span className="demo__mic-icon">🎤</span>
                <span className="demo__btn-label">Tap to Speak</span>
                <span className="demo__btn-hint">or press Space</span>
              </>
            )}
          </div>
        </motion.button>

        {/* Transcript */}
        {transcript && (
          <motion.div 
            className="demo__transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="demo__transcript-label">YOU SAID</span>
            <p className="demo__transcript-text">"{transcript}"</p>
          </motion.div>
        )}

        {/* Response */}
        {lastResponse && (
          <motion.div 
            className="demo__response"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="demo__response-label">RESPONSE</span>
            <p className="demo__response-text">{lastResponse}</p>
          </motion.div>
        )}

        {/* Memory Indicator */}
        <motion.div 
          className="demo__memory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="demo__memory-header">
            <span className="demo__memory-icon">🧠</span>
            <span className="demo__memory-title">SHORT-TERM MEMORY</span>
          </div>
          {sceneMemory ? (
            <p className="demo__memory-content">{sceneMemory}</p>
          ) : (
            <p className="demo__memory-empty">No scene captured yet. Try asking "What's around me?"</p>
          )}
        </motion.div>

        {/* Help */}
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
};

export default Demo;

