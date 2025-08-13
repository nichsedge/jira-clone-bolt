import { supabase } from '../lib/supabase';
import type { Ticket, CreateTicketData, UpdateTicketData, TicketHistory, EmailSyncLog } from '../types/ticket';

export class TicketService {
  // Get all tickets with optional filtering
  static async getTickets(filters?: {
    status?: Ticket['status'];
    priority?: Ticket['priority'];
    email?: string;
  }): Promise<Ticket[]> {
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.email) {
      query = query.ilike('email', `%${filters.email}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Get single ticket by ID
  static async getTicket(id: string): Promise<Ticket | null> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // Create new ticket
  static async createTicket(ticketData: CreateTicketData): Promise<Ticket> {
    const { data, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update existing ticket
  static async updateTicket(id: string, updates: UpdateTicketData): Promise<Ticket> {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If status changed to DONE, trigger email notification
    if (updates.status === 'DONE') {
      await this.triggerEmailNotification(data);
    }

    return data;
  }

  // Delete ticket
  static async deleteTicket(id: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get ticket history
  static async getTicketHistory(ticketId: string): Promise<TicketHistory[]> {
    const { data, error } = await supabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get email sync logs
  static async getEmailSyncLogs(): Promise<EmailSyncLog[]> {
    const { data, error } = await supabase
      .from('email_sync_logs')
      .select('*')
      .order('sync_started_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  // Trigger email sync
  static async triggerEmailSync(): Promise<void> {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email sync failed: ${error}`);
    }
  }

  // Private method to trigger email notification
  private static async triggerEmailNotification(ticket: Ticket): Promise<void> {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
      // Don't throw here to avoid blocking ticket updates
    }
  }
}