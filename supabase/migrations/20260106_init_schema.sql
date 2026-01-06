-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create project_files table
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, path)
);

-- Create project_changesets table
CREATE TABLE IF NOT EXISTS project_changesets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ops JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cli_tokens table for CLI authentication
CREATE TABLE IF NOT EXISTS cli_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Create chat_conversations table for storing AI chat history
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat_messages table for storing individual messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  file_context JSONB, -- Store file structure and active file context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ai_suggestions table for proactive AI suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'next_step', 'improvement', 'bug_fix', etc.
  content TEXT NOT NULL,
  context JSONB, -- Store context that triggered the suggestion
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, path);
CREATE INDEX IF NOT EXISTS idx_project_changesets_project_id ON project_changesets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_changesets_created_at ON project_changesets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cli_tokens_owner_id ON cli_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_cli_tokens_token_hash ON cli_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_project_id ON chat_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_project_id ON ai_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_dismissed ON ai_suggestions(project_id, dismissed);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_changesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cli_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects table
-- Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for project_files table
-- Users can view files in their own projects
CREATE POLICY "Users can view files in own projects"
  ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can insert files in their own projects
CREATE POLICY "Users can insert files in own projects"
  ON project_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can update files in their own projects
CREATE POLICY "Users can update files in own projects"
  ON project_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can delete files in their own projects
CREATE POLICY "Users can delete files in own projects"
  ON project_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for project_changesets table
-- Users can view changesets in their own projects
CREATE POLICY "Users can view changesets in own projects"
  ON project_changesets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_changesets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Users can insert changesets in their own projects
CREATE POLICY "Users can insert changesets in own projects"
  ON project_changesets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_changesets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for cli_tokens table
-- Users can view their own tokens
CREATE POLICY "Users can view own tokens"
  ON cli_tokens FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
  ON cli_tokens FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own tokens (for revocation)
CREATE POLICY "Users can update own tokens"
  ON cli_tokens FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
  ON cli_tokens FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for chat_conversations table
CREATE POLICY "Users can view conversations in own projects"
  ON chat_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = chat_conversations.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversations in own projects"
  ON chat_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = chat_conversations.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for chat_messages table
CREATE POLICY "Users can view messages in own conversations"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations cc
      JOIN projects p ON p.id = cc.project_id
      WHERE cc.id = chat_messages.conversation_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations cc
      JOIN projects p ON p.id = cc.project_id
      WHERE cc.id = chat_messages.conversation_id
      AND p.owner_id = auth.uid()
    )
  );

-- RLS Policies for ai_suggestions table
CREATE POLICY "Users can view suggestions for own projects"
  ON ai_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_suggestions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert suggestions in own projects"
  ON ai_suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_suggestions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update suggestions in own projects"
  ON ai_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_suggestions.project_id
      AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_suggestions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
