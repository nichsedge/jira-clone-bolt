/*
  # Ticket Management System Schema

  1. New Tables
    - `tickets`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text)
      - `status` (text, default 'OPEN')
      - `priority` (text, default 'MEDIUM')
      - `email` (text, required - email address of requester)
      - `email_message_id` (text, unique - for tracking email responses)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `ticket_history`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key)
      - `field_name` (text)
      - `old_value` (text)
      - `new_value` (text)
      - `changed_by` (text)
      - `created_at` (timestamp)
    
    - `email_sync_logs`
      - `id` (uuid, primary key)
      - `sync_started_at` (timestamp)
      - `sync_completed_at` (timestamp)
      - `emails_processed` (integer, default 0)
      - `tickets_created` (integer, default 0)
      - `status` (text, default 'RUNNING')
      - `error_message` (text)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (simplified for MVP)

  3. Indexes
    - Add indexes for common queries
*/

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  priority text DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  email text NOT NULL,
  email_message_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket history for audit trail
CREATE TABLE IF NOT EXISTS ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

-- Email sync logs
CREATE TABLE IF NOT EXISTS email_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at timestamptz DEFAULT now(),
  sync_completed_at timestamptz,
  emails_processed integer DEFAULT 0,
  tickets_created integer DEFAULT 0,
  status text DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  error_message text
);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for public access (simplified for MVP)
CREATE POLICY "Allow all operations on tickets"
  ON tickets
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on ticket_history"
  ON ticket_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on email_sync_logs"
  ON email_sync_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_email ON tickets(email);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_sync_logs_created_at ON email_sync_logs(sync_started_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log ticket changes
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'status', OLD.status, NEW.status);
  END IF;
  
  -- Log priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'priority', OLD.priority, NEW.priority);
  END IF;
  
  -- Log title changes
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO ticket_history (ticket_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'title', OLD.title, NEW.title);
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to log changes
CREATE TRIGGER log_ticket_changes_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_changes();