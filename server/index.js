import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a concise assistant for a blind person using smart glasses.
Respond in 1-3 short sentences. Use spatial language (left, right, ahead, behind, clock positions).
Say "I notice" not "I see". Prioritize safety-relevant information first.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'flag_hazard',
      description: 'Flag a safety hazard or obstacle detected in the scene. Use this whenever you identify something dangerous — steps, obstacles, wet floors, low-hanging objects, moving vehicles.',
      parameters: {
        type: 'object',
        properties: {
          hazard: { type: 'string', description: 'Brief description of the hazard' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How immediately dangerous this is' }
        },
        required: ['hazard', 'urgency']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Look up a specific detail from the most recent scene memory to answer a follow-up question about something previously observed.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What specific detail to recall from memory' }
        },
        required: ['query']
      }
    }
  }
];

// In-memory hazard log (persists for the session)
const hazardLog = [];

function executeToolCall(name, args, sceneContext) {
  if (name === 'flag_hazard') {
    const entry = { ...args, timestamp: new Date().toISOString() };
    hazardLog.push(entry);
    console.log('[Hazard flagged]', entry);
    return `Hazard logged: ${args.hazard} (${args.urgency} urgency)`;
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
    const { message, image, sceneContext, conversationHistory = [], maxTokens = 200 } = req.body;
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
            type: 'image_url',
            image_url: {
              url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
              detail: 'low'  // faster + cheaper; sufficient for scene description
            }
          },
          { type: 'text', text: message }
        ]
      : message;

    const messages = [
      { role: 'system', content: systemContent },
      ...conversationHistory.slice(-4).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent }
    ];

    let fullText = '';
    let toolCalls = [];
    const toolsUsed = [];

    // Stream response — text tokens arrive immediately
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      max_tokens: maxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullText += delta.content;
        res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
      }

      // Accumulate tool call argument fragments across chunks
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { id: tc.id, name: tc.function?.name || '', arguments: '' };
          }
          if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
          if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
        }
      }
    }

    // Execute any tool calls the model made
    toolCalls = toolCalls.filter(Boolean);
    if (toolCalls.length > 0) {
      const assistantToolMsg = {
        role: 'assistant',
        content: fullText || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments }
        }))
      };

      const toolResultMsgs = toolCalls.map(tc => {
        let args = {};
        try { args = JSON.parse(tc.arguments); } catch {}
        const result = executeToolCall(tc.name, args, sceneContext);
        toolsUsed.push(tc.name);
        return { role: 'tool', tool_call_id: tc.id, content: result };
      });

      // If model paused for tools before generating text, get the continuation
      if (!fullText.trim()) {
        const continuation = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [...messages, assistantToolMsg, ...toolResultMsgs],
          max_tokens: 200,
          stream: true
        });
        for await (const chunk of continuation) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
          }
        }
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
  res.json({ status: 'ok', model: 'gpt-4o-mini', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\nSonarAI server running on http://localhost:${PORT}\n`);
});
