import { createClient } from 'npm:@supabase/supabase-js@2';

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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: syncLog, error: logError } = await supabaseClient
      .from('email_sync_logs')
      .insert({
        status: 'RUNNING',
        sync_started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw new Error(`Failed to create sync log: ${logError.message}`);

    let emailsProcessed = 0;
    let ticketsCreated = 0;
    let errorMessage = null;

    try {
      const emails = await fetchUnreadTicketEmails();
      emailsProcessed = emails.length;

      for (const email of emails) {
        try {
          const { data: existingTicket } = await supabaseClient
            .from('tickets')
            .select('id')
            .eq('email_message_id', email.messageId)
            .single();

          if (!existingTicket) {
            const title = email.subject.replace(/^\[TICKET\]\s*/, '').trim() || 'Ticket from Email';

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

            if (!createError) ticketsCreated++;
          }

          await markEmailAsRead(email.id);
        } catch (err) {
          console.error('Error processing email:', email.id, err);
        }
      }

      await supabaseClient
        .from('email_sync_logs')
        .update({
          status: 'COMPLETED',
          sync_completed_at: new Date().toISOString(),
          emails_processed: emailsProcessed,
          tickets_created: ticketsCreated,
        })
        .eq('id', syncLog.id);

    } catch (err) {
      errorMessage = err.message;
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
      throw err;
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsProcessed,
        ticketsCreated,
        message: `Processed ${emailsProcessed} emails, created ${ticketsCreated} tickets`
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Email sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Email sync failed', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

async function fetchUnreadTicketEmails(): Promise<EmailMessage[]> {
  const baseUrl = Deno.env.get('EMAIL_API_URL');
  if (!baseUrl) throw new Error("EMAIL_API_URL environment variable is not set");

  const resp = await fetch(`${baseUrl}/emails?filter_by=today&mark_as_read=false`);
  if (!resp.ok) throw new Error(`Failed to fetch emails: ${resp.statusText}`);

  const { emails } = await resp.json();
  return emails.filter((e: EmailMessage) => e.subject.includes("[TICKET]"));
}

async function markEmailAsRead(emailId: string): Promise<void> {
  try {
    const baseUrl = Deno.env.get('EMAIL_API_URL');
    if (!baseUrl) throw new Error("EMAIL_API_URL environment variable is not set");

    await fetch(`${baseUrl}/emails/${emailId}/mark-read`, { method: 'POST' });
  } catch (err) {
    console.error(`Failed to mark email ${emailId} as read:`, err);
  }
}
