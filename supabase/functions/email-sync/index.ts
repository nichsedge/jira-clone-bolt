const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  body: string;
  messageId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create a new sync log entry
    const { data: syncLog, error: logError } = await supabaseClient
      .from('email_sync_logs')
      .insert({
        status: 'RUNNING',
        sync_started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create sync log: ${logError.message}`);
    }

    let emailsProcessed = 0;
    let ticketsCreated = 0;
    let errorMessage = null;

    try {
      // Fetch unread emails with [TICKET] in subject
      const emails = await fetchUnreadTicketEmails();
      emailsProcessed = emails.length;

      // Create tickets for each email
      for (const email of emails) {
        try {
          // Check if ticket already exists for this email message ID
          const { data: existingTicket } = await supabaseClient
            .from('tickets')
            .select('id')
            .eq('email_message_id', email.messageId)
            .single();

          if (!existingTicket) {
            // Extract title from subject (remove [TICKET] prefix)
            const title = email.subject.replace(/^\[TICKET\]\s*/, '').trim() || 'Ticket from Email';

            // Create new ticket
            const { error: createError } = await supabaseClient
              .from('tickets')
              .insert({
                title,
                description: email.body,
                email: email.from,
                email_message_id: email.messageId,
                status: 'OPEN',
                priority: 'MEDIUM',
              });

            if (!createError) {
              ticketsCreated++;
            } else {
              console.error('Failed to create ticket for email:', email.id, createError);
            }
          }

          // Mark email as read (implementation depends on email provider)
          await markEmailAsRead(email.id);
        } catch (error) {
          console.error('Error processing email:', email.id, error);
        }
      }

      // Update sync log with success
      await supabaseClient
        .from('email_sync_logs')
        .update({
          status: 'COMPLETED',
          sync_completed_at: new Date().toISOString(),
          emails_processed: emailsProcessed,
          tickets_created: ticketsCreated,
        })
        .eq('id', syncLog.id);

    } catch (error) {
      errorMessage = error.message;
      
      // Update sync log with failure
      await supabaseClient
        .from('email_sync_logs')
        .update({
          status: 'FAILED',
          sync_completed_at: new Date().toISOString(),
          emails_processed: emailsProcessed,
          tickets_created: ticketsCreated,
          error_message: errorMessage,
        })
        .eq('id', syncLog.id);

      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsProcessed,
        ticketsCreated,
        message: `Successfully processed ${emailsProcessed} emails and created ${ticketsCreated} tickets`
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Email sync error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Email sync failed',
        success: false,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

// Mock function - replace with actual email provider integration
async function fetchUnreadTicketEmails(): Promise<EmailMessage[]> {
  // This is a mock implementation
  // Replace with actual email provider API calls (Gmail, Outlook, etc.)
  
  // For demonstration, return empty array
  // In real implementation, you would:
  // 1. Connect to email provider API (Gmail, Outlook, etc.)
  // 2. Search for unread emails with [TICKET] in subject
  // 3. Return array of EmailMessage objects
  
  console.log('Mock: Fetching unread emails with [TICKET] in subject');
  return [];
}

// Mock function - replace with actual email provider integration
async function markEmailAsRead(emailId: string): Promise<void> {
  // Mock implementation
  // Replace with actual email provider API call to mark email as read
  console.log(`Mock: Marking email ${emailId} as read`);
}

// Import createClient after the functions are defined
import { createClient } from 'npm:@supabase/supabase-js@2';