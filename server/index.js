/**
 * VisionAI Backend Server
 * 
 * This is the API layer that handles:
 * 1. Scene analysis via Gemini Vision API
 * 2. Conversational responses via Gemini Chat API
 * 
 * Designed to be the "intelligence layer" for future smart glasses.
 */

import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large base64 images

// Initialize Gemini API
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your_key_here' || API_KEY === 'YOUR_API_KEY_HERE') {
  console.warn(`
⚠️  WARNING: No valid Gemini API key found!
   
   1. Get a free API key at: https://makersuite.google.com/app/apikey
   2. Add it to your .env file: GEMINI_API_KEY=your_actual_key
   3. Restart this server
  `);
}

const genAI = new GoogleGenerativeAI(API_KEY || 'MISSING_KEY');

// ============================================
// VISION PROMPT - Optimized for blind users
// ============================================
const VISION_PROMPT = `Describe this scene for a blind person in 2–3 sentences.
Focus on spatial layout, obstacles, and objects that affect movement.
Summarize what matters. Do not list everything.
Use directional language (left, right, ahead, behind).
Prioritize safety-relevant information (stairs, edges, obstacles).`;

// ============================================
// CHAT SYSTEM PROMPT - Conversational assistant
// ============================================
const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for a blind person using smart glasses.
Your responses should be:
- Concise (1-3 sentences max)
- Conversational and warm
- Use uncertainty language when appropriate ("I might be mistaken, but…", "It appears that…")
- Prioritize safety-relevant information
- Use spatial/directional language (left, right, ahead)
- Never say "I can see" - say "I notice" or "It appears"

You have access to the most recent scene description. Use it to answer follow-up questions.
If asked about something not in the scene, politely say you'd need a new image to check.`;

/**
 * POST /api/analyze
 * 
 * Analyzes a webcam image using Gemini Vision API
 * Returns a structured scene description for blind users
 * 
 * @body {string} image - Base64 encoded image data
 * @returns {object} { description: string }
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // ============================================
    // WHERE THE VISION API IS CALLED
    // ============================================
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    const result = await model.generateContent([
      VISION_PROMPT,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      }
    ]);

    const description = result.response.text();
    
    console.log('[Vision API] Scene analyzed:', description.substring(0, 100) + '...');
    
    res.json({ description });
  } catch (error) {
    console.error('[Vision API Error]', error);
    
    // Check for API key issues
    if (error.message?.includes('API_KEY') || error.message?.includes('API key')) {
      return res.status(500).json({ 
        error: 'Invalid or missing API key', 
        details: 'Please add a valid GEMINI_API_KEY to your .env file. Get one at https://makersuite.google.com/app/apikey'
      });
    }
    
    res.status(500).json({ error: 'Failed to analyze image', details: error.message });
  }
});

/**
 * POST /api/chat
 * 
 * Generates conversational responses using Gemini Chat API
 * Takes into account the scene context for follow-up questions
 * 
 * @body {string} message - User's spoken message
 * @body {string} sceneContext - Last scene description (SHORT-TERM MEMORY)
 * @body {array} conversationHistory - Previous exchanges
 * @returns {object} { response: string }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sceneContext, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // ============================================
    // WHERE THE CHAT API IS CALLED
    // Uses scene context from SHORT-TERM MEMORY
    // ============================================
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Build context with scene memory
    let contextPrompt = CHAT_SYSTEM_PROMPT;
    
    if (sceneContext) {
      contextPrompt += `\n\nMost recent scene description:\n"${sceneContext}"`;
    } else {
      contextPrompt += `\n\nNo scene has been captured yet. If the user asks about their surroundings, suggest they capture a new image.`;
    }
    
    // Include conversation history for context
    if (conversationHistory.length > 0) {
      contextPrompt += '\n\nRecent conversation:';
      conversationHistory.slice(-4).forEach(turn => {
        contextPrompt += `\n${turn.role}: ${turn.content}`;
      });
    }
    
    contextPrompt += `\n\nUser: ${message}\nAssistant:`;
    
    const result = await model.generateContent(contextPrompt);
    const response = result.response.text();
    
    console.log('[Chat API] Response:', response.substring(0, 100) + '...');
    
    res.json({ response });
  } catch (error) {
    console.error('[Chat API Error]', error);
    res.status(500).json({ error: 'Failed to generate response', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    VisionAI MVP Server                    ║
║                                                           ║
║   🎯 Accessibility intelligence layer for smart glasses   ║
║   🔗 API running on http://localhost:${PORT}                 ║
║                                                           ║
║   Endpoints:                                              ║
║   • POST /api/analyze - Vision analysis                   ║
║   • POST /api/chat    - Conversational AI                 ║
║   • GET  /api/health  - Health check                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

