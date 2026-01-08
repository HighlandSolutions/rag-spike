-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for PoC
-- Allow all operations for now (can be made tenant-aware later)
-- For production, you would add policies like:
-- CREATE POLICY "Users can view their tenant's documents"
--   ON documents FOR SELECT
--   USING (tenant_id = current_setting('app.tenant_id', true));

-- For PoC: Allow all operations (can be restricted later)
CREATE POLICY "Allow all operations on documents" ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on chunks" ON chunks
  FOR ALL
  USING (true)
  WITH CHECK (true);




