import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a coding assistant. When the user asks you to create or modify files, respond with:
1. A brief message explaining what you're doing
2. A JSON array of file operations

Format your response as:
{
  "message": "Your explanation here",
  "ops": [
    { "op": "writeFile", "path": "file/path.ts", "content": "file content here" },
    { "op": "deleteFile", "path": "file/to/delete.ts" }
  ]
}

Always respond with valid JSON in this exact format. The ops array should contain objects with:
- op: either "writeFile" or "deleteFile"
- path: the file path
- content: the file content (only for writeFile)

Be concise and focused. Create complete, working code.`;

interface RequestBody {
  prompt: string;
  files: Array<{ path: string; content: string }>;
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
    const { prompt, files } = body;

    const openai = new OpenAI({ apiKey });

    // Build context from files
    const fileContext = files.length > 0
      ? `\n\nCurrent files in the project:\n${files
          .map((f) => `--- ${f.path} ---\n${f.content}`)
          .join('\n\n')}`
      : '';

    const userMessage = `${prompt}${fileContext}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
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
