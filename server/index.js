import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a concise assistant for a blind person using smart glasses.
Respond in 1-3 short sentences. Use spatial language (left, right, ahead, behind, clock positions).
Say "I notice" not "I see". Prioritize safety-relevant information first.`;

const TOOLS = [
  {
    name: 'flag_hazard',
    description: 'Flag a safety hazard or obstacle detected in the scene. Use this whenever you identify something dangerous — steps, obstacles, wet floors, low-hanging objects, moving vehicles.',
    input_schema: {
      type: 'object',
      properties: {
        hazard: { type: 'string', description: 'Brief description of the hazard' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How immediately dangerous this is' }
      },
      required: ['hazard', 'urgency']
    }
  },
  {
    name: 'recall_memory',
    description: 'Look up a specific detail from the most recent scene memory to answer a follow-up question about something previously observed.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What specific detail to recall from memory' }
      },
      required: ['query']
    }
  }
];

// In-memory hazard log (persists for the session)
const hazardLog = [];

function executeToolCall(name, input, sceneContext) {
  if (name === 'flag_hazard') {
    const entry = { ...input, timestamp: new Date().toISOString() };
    hazardLog.push(entry);
    console.log('[Hazard flagged]', entry);
    return `Hazard logged: ${input.hazard} (${input.urgency} urgency)`;
  }
  if (name === 'recall_memory') {
    return sceneContext
      ? `From scene memory: "${sceneContext}"`
      : 'No scene memory available yet.';
  }
  return 'Tool executed.';
}

// Unified chat + vision endpoint — handles both text-only and image+text requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message, image, sceneContext, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let systemContent = SYSTEM_PROMPT;
    if (sceneContext) systemContent += `\n\nScene memory: "${sceneContext}"`;

    // Build user message — include image as vision content if provided
    const userContent = image
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: image.includes(',') ? image.split(',')[1] : image
            }
          },
          { type: 'text', text: message }
        ]
      : message;

    const messages = [
      ...conversationHistory.slice(-4).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent }
    ];

    let fullText = '';
    const toolsUsed = [];

    // Stream the response — text tokens arrive immediately
    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemContent,
      messages,
      tools: TOOLS
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    const finalMsg = await stream.finalMessage();

    // Execute any tool calls the model made
    const toolUseBlocks = finalMsg.content.filter(b => b.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      const toolResults = toolUseBlocks.map(block => {
        const result = executeToolCall(block.name, block.input, sceneContext);
        toolsUsed.push(block.name);
        return { type: 'tool_result', tool_use_id: block.id, content: result };
      });

      // If model paused for tools before generating text, get the continuation
      if (!fullText.trim()) {
        const continuation = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: systemContent,
          messages: [
            ...messages,
            { role: 'assistant', content: finalMsg.content },
            { role: 'user', content: toolResults }
          ],
          tools: TOOLS
        });
        const contText = continuation.content.find(b => b.type === 'text')?.text || '';
        fullText = contText;
        if (contText) res.write(`data: ${JSON.stringify({ text: contText })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, tools: toolsUsed })}\n\n`);
    res.end();

    console.log('[Chat]', fullText.slice(0, 80) + (fullText.length > 80 ? '...' : ''));
    if (toolsUsed.length) console.log('[Tools used]', toolsUsed.join(', '));
  } catch (err) {
    console.error('[Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'claude-haiku-4-5-20251001', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\nSonarAI server running on http://localhost:${PORT}\n`);
});
