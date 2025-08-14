import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapClient } from 'jsr:@workingdevshero/deno-imap';

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

          // Mark email as read
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

// Function to extract plain text from email body
function extractPlainTextFromBody(messageBody: string): string {
  try {
    // Handle multipart messages
    if (messageBody.includes('Content-Type: text/plain')) {
      const parts = messageBody.split(/--\w+/);
      for (const part of parts) {
        if (part.includes('Content-Type: text/plain')) {
          const lines = part.split('\r\n');
          let foundContentType = false;
          let textContent = '';
          
          for (const line of lines) {
            if (foundContentType && line.trim() && !line.startsWith('Content-')) {
              textContent += line + '\n';
            } else if (line.includes('Content-Type: text/plain')) {
              foundContentType = true;
            }
          }
          
          if (textContent.trim()) {
            return textContent.trim();
          }
        }
      }
    }
    
    // If no plain text part found, try to extract from HTML or return raw
    if (messageBody.includes('<div') && messageBody.includes('</div>')) {
      const htmlMatch = messageBody.match(/<div[^>]*>(.*?)<\/div>/s);
      if (htmlMatch) {
        return htmlMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }
    
    // Fallback: return cleaned message body
    return messageBody
      .replace(/--\w+/g, '')
      .replace(/Content-Type:.*?\n/g, '')
      .replace(/Content-Transfer-Encoding:.*?\n/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();
  } catch (error) {
    console.error('Error extracting plain text:', error);
    return messageBody;
  }
}

// IMAP implementation to fetch unread emails with [TICKET] in subject
async function fetchUnreadTicketEmails(): Promise<EmailMessage[]> {
  let client: ImapClient | null = null;
  
  try {
    // Validate environment variables
    const requiredEnvVars = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS'];
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Create IMAP client
    client = new ImapClient({
      host: Deno.env.get('IMAP_HOST')!,
      port: parseInt(Deno.env.get('IMAP_PORT')!),
      tls: Deno.env.get('IMAP_USE_TLS') !== 'false',
      username: Deno.env.get('IMAP_USER')!,
      password: Deno.env.get('IMAP_PASS')!,
    });

    console.log('Connecting to IMAP server...');
    
    // Connect and authenticate
    await client.connect();
    await client.authenticate();
    
    console.log('Connected and authenticated successfully');

    // Select inbox
    const inbox = await client.selectMailbox('INBOX');
    console.log(`INBOX has ${inbox.exists} messages`);

    if (!inbox.exists || inbox.exists === 0) {
      return [];
    }

    // Search for unread messages with "[TICKET]" in subject
    console.log('Searching for unread messages with [TICKET] in subject...');
    
    // Search for both unread AND containing [TICKET] in subject
    const ticketMessages = await client.search({
      subject: '[TICKET]',
      unseen: true  // Only unread messages
    });

    console.log(`Found ${ticketMessages.length} unread messages with [TICKET] in subject`);

    if (ticketMessages.length === 0) {
      return [];
    }

    // Fetch detailed information for ticket messages
    const emailMessages: EmailMessage[] = [];
    
    for (const messageId of ticketMessages) {
      try {
        const messages = await client.fetch(`${messageId}`, {
          envelope: true,
          headers: ['Subject', 'From', 'To', 'Date', 'Message-ID'],
          flags: true,
        });

        for (const message of messages) {
          // Skip if message is already read (double-check)
          if (message.flags?.includes('\\Seen')) {
            continue;
          }

          const fromEmail = message.envelope?.from?.[0] 
            ? `${message.envelope.from[0].mailbox}@${message.envelope.from[0].host}`
            : 'Unknown';

          // Fetch full message body
          const rawMessage = await client.fetch(
            message.seq.toString(),
            { full: true, markSeen: false }
          );
          
          const rawBody = new TextDecoder().decode(rawMessage[0].parts.TEXT.data);
          const cleanBody = extractPlainTextFromBody(rawBody);

          emailMessages.push({
            id: message.seq.toString(),
            messageId: message.envelope?.messageId || `seq-${message.seq}`,
            subject: message.envelope?.subject || 'No Subject',
            from: fromEmail,
            body: cleanBody,
          });
        }
      } catch (fetchError) {
        console.error(`Error fetching message ${messageId}:`, fetchError);
        // Continue with other messages even if one fails
      }
    }

    console.log(`Successfully retrieved ${emailMessages.length} unread ticket messages`);
    return emailMessages;

  } catch (error) {
    console.error('Error fetching emails via IMAP:', error);
    throw new Error(`IMAP fetch failed: ${error.message}`);
  } finally {
    // Always disconnect from IMAP server
    if (client) {
      try {
        await client.disconnect();
        console.log('Disconnected from IMAP server');
      } catch (disconnectError) {
        console.error('Error disconnecting from IMAP:', disconnectError);
      }
    }
  }
}

// IMAP implementation to mark email as read
async function markEmailAsRead(emailId: string): Promise<void> {
  let client: ImapClient | null = null;
  
  try {
    // Validate environment variables
    const requiredEnvVars = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS'];
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Create IMAP client
    client = new ImapClient({
      host: Deno.env.get('IMAP_HOST')!,
      port: parseInt(Deno.env.get('IMAP_PORT')!),
      tls: Deno.env.get('IMAP_USE_TLS') !== 'false',
      username: Deno.env.get('IMAP_USER')!,
      password: Deno.env.get('IMAP_PASS')!,
    });

    // Connect and authenticate
    await client.connect();
    await client.authenticate();
    
    // Select inbox
    await client.selectMailbox('INBOX');

    // Mark the specific message as read using sequence number
    await client.store(emailId, { flags: ['\\Seen'] }, 'add');
    
    console.log(`Successfully marked email ${emailId} as read`);

  } catch (error) {
    console.error(`Error marking email ${emailId} as read:`, error);
    // Don't throw error here to avoid breaking the main flow
  } finally {
    // Always disconnect from IMAP server
    if (client) {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting from IMAP:', disconnectError);
      }
    }
  }
}