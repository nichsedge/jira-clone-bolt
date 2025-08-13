export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  email: string;
  email_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  created_at: string;
}

export interface EmailSyncLog {
  id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  emails_processed: number;
  tickets_created: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error_message: string | null;
}

export interface CreateTicketData {
  title: string;
  description?: string;
  status?: Ticket['status'];
  priority?: Ticket['priority'];
  email: string;
  email_message_id?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: Ticket['status'];
  priority?: Ticket['priority'];
  email?: string;
}