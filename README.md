# nextjs-coding-tool

A web-based AI-powered coding tool (Lovable-clone style) built with Next.js. This MVP features a Monaco editor, chat-driven coding agent, and persistent project storage via Supabase.

## Features

- **3-Pane Layout**: File list, Monaco code editor, and AI chat panel
- **AI-Powered Coding**: Chat with an AI assistant that can create and modify files
- **Project Management**: Create, save, and load projects stored in Supabase
- **Local Filesystem**: All files are stored in IndexedDB (browser storage) for quick access
- **Persistent Storage**: Projects can be saved to Supabase and synced across devices
- **Apply Changes Workflow**: Review AI-generated changes before applying them to your project
- **Real-time Streaming**: See AI responses stream in real-time via Server-Sent Events
- **Undo/Revert**: Revert the last AI-generated changes with one click
- **Edge Runtime**: API routes run on Vercel Edge for fast, global performance
- **CLI-Ready**: Export projects for local development (CLI tool coming soon)

## Getting Started

### Prerequisites

- Node.js (LTS recommended, v18+)
- npm / pnpm / yarn
- An OpenAI API key
- A Supabase project (for persistent storage)

### Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Create a `.env.local` file in the root directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Set up Supabase**:
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Run the migration in `supabase/migrations/20260106_init_schema.sql` in your Supabase SQL editor
   - Enable GitHub OAuth provider in Supabase Authentication settings
   - Add your site URL to the allowed redirect URLs

4. **Run the development server**:
```bash
npm run dev
```

5. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

### Deployment

This app is designed to deploy seamlessly to Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add the environment variables in Vercel project settings:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Configure Supabase integration in Vercel (optional but recommended)
5. Deploy!

## How It Works

### Local Development
1. **Create files** using the "New File" button or ask the AI to create them
2. **Edit files** in the Monaco editor - changes are auto-saved to IndexedDB
3. **Chat with AI** to generate or modify code - it returns structured operations
4. **Review changes** - AI operations are applied to local files immediately
5. **Revert if needed** - use the "Revert Last AI Change" button to undo AI modifications

### Project Persistence
1. **Sign in** with GitHub to access project management
2. **Create a project** - optionally seed with a Next.js template
3. **Load projects** - open existing projects from Supabase
4. **Apply changes** - after AI generates code, click "Apply to Project" to persist to Supabase
5. **Run locally** - use the CLI command to download and run your project locally (coming soon)

## Scripts

- `npm run dev` — Start the development server
- `npm run build` — Create a production build
- `npm run start` — Start the production server
- `npm run lint` — Run linting

## API Endpoints

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/[projectId]` - Get project metadata
- `GET /api/projects/[projectId]/files` - List project files (add `?includeContent=true` for full content)
- `POST /api/projects/[projectId]/apply` - Apply file operations to project
- `GET /api/projects/[projectId]/export` - Export project as JSON bundle (supports CLI token auth)

### AI
- `POST /api/ai` - Stream AI responses with file operations

## Database Schema

The Supabase database includes:

- **projects** - Store project metadata
- **project_files** - Store file contents with unique (project_id, path) constraint
- **project_changesets** - Track change history (optional)
- **cli_tokens** - API tokens for CLI authentication

All tables have Row Level Security (RLS) enabled to ensure users can only access their own data.

## Architecture

- **Frontend**: Next.js 15 with App Router, React 18, Monaco Editor
- **Backend**: Server Components and API routes with Supabase integration
- **Storage**: 
  - IndexedDB (via `idb` library) for local virtual filesystem
  - Supabase PostgreSQL for persistent project storage
- **Authentication**: Supabase Auth with GitHub OAuth
- **AI**: OpenAI GPT-4o-mini with structured JSON responses

## Future Enhancements

- **CLI Tool**: `npx nextjs-coding-tool dev [projectId]` to run projects locally
- **Real-time Collaboration**: Multiple users editing the same project
- **Version Control**: Git-like branching and merging
- **Template Library**: Pre-built project templates
- **Export Options**: Export to GitHub, CodeSandbox, etc.

## Repository Owner

**Vikas is the owner of this repository.**
