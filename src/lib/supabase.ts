import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  console.error('Current values:', { supabaseUrl, supabaseKey: supabaseKey ? '[REDACTED]' : 'undefined' });
}

// Create a mock client if environment variables are missing
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : {
      from: () => ({
        select: () => ({
          order: () => ({
            eq: () => ({
              ilike: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') })
            }),
            ilike: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
            then: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') })
          }),
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
          }),
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          then: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') })
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
          })
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
            })
          })
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: new Error('Supabase not configured') })
        })
      })
    } as any;

export type Database = {
  public: {
    Tables: {
      tickets: {
        Row: {
          id: string;
          title: string;
          description: string;
          status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
          priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          email: string;
          email_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
          priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          email: string;
          email_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
          priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          email?: string;
          email_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ticket_history: {
        Row: {
          id: string;
          ticket_id: string;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          changed_by: string;
          created_at: string;
        };
      };
      email_sync_logs: {
        Row: {
          id: string;
          sync_started_at: string;
          sync_completed_at: string | null;
          emails_processed: number;
          tickets_created: number;
          status: 'RUNNING' | 'COMPLETED' | 'FAILED';
          error_message: string | null;
        };
      };
    };
  };
};