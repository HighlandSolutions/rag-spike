-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  title TEXT, -- Optional title for the session (e.g., first message or user-defined)
  user_context JSONB, -- Store user context (role, level, target_job, learning_preferences)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  chunk_ids TEXT[], -- Array of chunk IDs referenced in this message
  error BOOLEAN DEFAULT FALSE, -- Indicates if this message represents an error state
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_id ON chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Add updated_at trigger for chat_sessions
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all operations for PoC, can be made tenant-aware later)
CREATE POLICY "Allow all operations on chat_sessions" ON chat_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on chat_messages" ON chat_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE chat_sessions IS 'Stores chat conversation sessions';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';
COMMENT ON COLUMN chat_sessions.user_context IS 'JSON metadata for user context (role, level, target_job, learning_preferences)';
COMMENT ON COLUMN chat_messages.chunk_ids IS 'Array of chunk IDs referenced in assistant messages for citations';




