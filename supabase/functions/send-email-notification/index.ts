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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticketId }: TicketNotificationRequest = await req.json();

    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

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
    if (ticket.status !== 'DONE') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email notification only sent for DONE tickets',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Send email notification
    const emailSent = await sendEmailNotification(ticket);

    if (!emailSent) {
      throw new Error('Failed to send email notification');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email notification sent to ${ticket.email}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send email notification',
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

// Mock function - replace with actual email sending service
async function sendEmailNotification(ticket: any): Promise<boolean> {
  // This is a mock implementation
  // Replace with actual email sending service (SendGrid, Nodemailer, etc.)
  
  const emailContent = {
    to: ticket.email,
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
    `.trim(),
  };

  console.log('Mock: Sending email notification:', emailContent);

  // In real implementation, you would:
  // 1. Use an email service like SendGrid, AWS SES, or Nodemailer
  // 2. Format the email with proper HTML template
  // 3. Handle email delivery errors
  // 4. Return true/false based on delivery success

  // For demonstration, always return true
  return true;
}

// Import createClient after the functions are defined
import { createClient } from 'npm:@supabase/supabase-js@2';