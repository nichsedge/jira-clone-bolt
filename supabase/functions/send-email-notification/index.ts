import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.10';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TicketNotificationRequest {
  ticketId: string;
}

const transport = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST')!,
  port: Number(Deno.env.get('SMTP_PORT') || '587'),
  secure: Deno.env.get('SMTP_PORT') === '465',
  auth: {
    user: Deno.env.get('SMTP_USER')!,
    pass: Deno.env.get('SMTP_PASS')!
  }
});

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
    if (ticket.status.toUpperCase() !== 'DONE') {
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

async function sendEmailNotification(ticket: any): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      transport.sendMail({
        from: Deno.env.get('SMTP_USER')!,
        to: ticket.email,
        subject: `[TICKET] ${ticket.title} - Completed`,
        text: `
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
      }, (error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });

    console.log(`✅ Email sent successfully for Ticket ${ticket.id}!`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}