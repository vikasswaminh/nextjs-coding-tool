# nextjs-coding-tool

A web-based AI-powered coding tool (Lovable-clone style) built with Next.js. This MVP features a Monaco editor, chat-driven coding agent, and virtual filesystem stored in the browser.

## Features

- **3-Pane Layout**: File list, Monaco code editor, and AI chat panel
- **AI-Powered Coding**: Chat with an AI assistant that can create and modify files
- **Virtual Filesystem**: All files are stored in IndexedDB (browser storage)
- **Real-time Streaming**: See AI responses stream in real-time via Server-Sent Events
- **Undo/Revert**: Revert the last AI-generated changes with one click
- **Edge Runtime**: API routes run on Vercel Edge for fast, global performance

## Getting Started

### Prerequisites

- Node.js (LTS recommended, v18+)
- npm / pnpm / yarn
- An OpenAI API key

### Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Create a `.env.local` file in the root directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

3. **Run the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

### Deployment

This app is designed to deploy seamlessly to Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add the `OPENAI_API_KEY` environment variable in Vercel project settings
4. Deploy!

## Scripts

- `npm run dev` — Start the development server
- `npm run build` — Create a production build
- `npm run start` — Start the production server
- `npm run lint` — Run linting

## How It Works

1. **Create files** using the "New File" button or ask the AI to create them
2. **Edit files** in the Monaco editor - changes are auto-saved to IndexedDB
3. **Chat with AI** to generate or modify code - it returns structured operations
4. **Auto-apply changes** - file operations from AI are automatically applied to your virtual project
5. **Revert if needed** - use the "Revert Last AI Change" button to undo AI modifications

## Architecture

- **Frontend**: Next.js 15 with App Router, React 18, Monaco Editor
- **Backend**: Edge API routes with OpenAI streaming
- **Storage**: IndexedDB (via `idb` library) for persistent virtual filesystem
- **AI**: OpenAI GPT-4o-mini with structured JSON responses

## Repository Owner

**Vikas is the owner of this repository.**
