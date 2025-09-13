-- Create decks table for storing tldraw documents
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  doc JSONB,
  rev INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_decks_id ON decks(id);

-- Add RLS policies (adjust as needed for your auth setup)
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read/write their own decks
-- Adjust this based on your auth model
CREATE POLICY "Public decks access" ON decks
  FOR ALL
  USING (true)
  WITH CHECK (true);