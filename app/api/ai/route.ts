import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are an expert coding assistant and proactive pair programmer. Your role is to:

1. **Be conversational and helpful**: Engage naturally with the user, explain your reasoning, and ask clarifying questions when needed.

2. **Suggest next steps**: After completing a task, proactively suggest logical next steps like:
   - Adding tests for new features
   - Improving error handling
   - Optimizing performance
   - Adding documentation
   - Implementing related features

3. **Maintain context**: You have access to the full project file structure and content. Reference specific files and code when making suggestions.

4. **Be thorough**: When creating or modifying files:
   - Write complete, production-ready code
   - Include proper error handling
   - Add helpful comments where needed
   - Follow best practices and patterns used in the project

5. **Response format**: When making file changes, respond with:
{
  "message": "Detailed explanation of what you did and why. Suggest 2-3 logical next steps the user might want to take.",
  "ops": [
    { "op": "writeFile", "path": "file/path.ts", "content": "complete file content" },
    { "op": "deleteFile", "path": "file/to/delete.ts" }
  ],
  "suggestions": [
    "Next step 1: description",
    "Next step 2: description",
    "Next step 3: description"
  ]
}

6. **When not making changes**: If the user asks a question or needs guidance, respond with:
{
  "message": "Your detailed, helpful response with suggestions",
  "ops": [],
  "suggestions": ["relevant next steps"]
}

Always respond with valid JSON. Be proactive, helpful, and suggest meaningful next steps.`;

interface RequestBody {
  prompt: string;
  files: Array<{ path: string; content: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  projectId?: string;
  aiRole?: string;
  systemPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = (await req.json()) as RequestBody;
    const { prompt, files, conversationHistory = [], systemPrompt } = body;

    const openai = new OpenAI({ apiKey });

    // Use custom system prompt if provided, otherwise use default
    const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT;

    // Build context from files with file tree
    const fileTree = files.map(f => f.path).sort().join('\n');
    const fileContext = files.length > 0
      ? `\n\nProject File Structure:\n${fileTree}\n\nFile Contents:\n${files
          .map((f) => `--- ${f.path} ---\n${f.content}`)
          .join('\n\n')}`
      : '';

    const userMessage = `${prompt}${fileContext}`;

    // Build messages array with conversation history
    const messages: any[] = [
      { role: 'system', content: finalSystemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send status event
          controller.enqueue(
            encoder.encode(`event: status\ndata: ${JSON.stringify({ status: 'streaming' })}\n\n`)
          );

          // Stream tokens
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              fullResponse += delta;
              controller.enqueue(
                encoder.encode(`event: token\ndata: ${JSON.stringify({ delta })}\n\n`)
              );
            }
          }

          // Parse the full response as JSON
          try {
            const parsed = JSON.parse(fullResponse);
            controller.enqueue(
              encoder.encode(`event: result\ndata: ${JSON.stringify(parsed)}\n\n`)
            );
          } catch (parseError) {
            // JSON parsing failed, send error with raw output
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  error: 'Failed to parse JSON response',
                  raw: fullResponse,
                })}\n\n`
              )
            );
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
