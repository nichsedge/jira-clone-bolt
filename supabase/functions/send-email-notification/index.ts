import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TicketNotificationRequest {
  ticketId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ticketId }: TicketNotificationRequest = await req.json();
    if (!ticketId) throw new Error('Ticket ID is required');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Ticket not found: ${ticketError?.message || 'Unknown error'}`);
    }

    // Only send notification if ticket status is DONE
    if (ticket.status.toUpperCase() !== 'DONE') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email notification only sent for DONE tickets',
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send email via API
    const sent = await sendEmailNotification(ticket);
    if (!sent) throw new Error('Failed to send email notification');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email notification sent to ${extractEmailAddress(ticket.email)}`,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send email notification',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<(.+?)>/);
  if (match) return match[1];
  return raw.trim();
}

async function sendEmailNotification(ticket: any): Promise<boolean> {
  try {
    const baseUrl = Deno.env.get('EMAIL_API_URL');
    if (!baseUrl) throw new Error("EMAIL_API_URL environment variable is not set");

    const receiverEmail = extractEmailAddress(ticket.email);

    const params = new URLSearchParams({
      receiver_email: receiverEmail,
      subject: `[TICKET] ${ticket.title} - Completed`,
      body: `
Hello,

Your support ticket has been completed:

Title: ${ticket.title}
Description: ${ticket.description}
Status: DONE
Created: ${new Date(ticket.created_at).toLocaleString()}
Completed: ${new Date().toLocaleString()}

Thank you for contacting our support team.

Best regards,
Support Team
      `.trim()
    });

    const resp = await fetch(`${baseUrl}/send?${params.toString()}`, { method: 'POST' });
    if (!resp.ok) throw new Error(`Email API error: ${resp.statusText}`);

    const result = await resp.json();
    console.log(`✅ Email API response:`, result);

    return result.status === 'success';
  } catch (err) {
    console.error('Failed to send email via API:', err);
    return false;
  }
}
