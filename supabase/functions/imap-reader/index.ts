import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ImapClient } from 'jsr:@workingdevshero/deno-imap'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    const requiredEnvVars = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS']
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        throw new Error(`Missing required environment variable: ${envVar}`)
      }
    }

    // Create IMAP client
    const client = new ImapClient({
      host: Deno.env.get('IMAP_HOST')!,
      port: parseInt(Deno.env.get('IMAP_PORT')!),
      tls: Deno.env.get('IMAP_USE_TLS') !== 'false',
      username: Deno.env.get('IMAP_USER')!,
      password: Deno.env.get('IMAP_PASS')!,
    })

    console.log('Connecting to IMAP server...')
    
    // Connect and authenticate
    await client.connect()
    await client.authenticate()
    
    console.log('Connected and authenticated successfully')

    // Select inbox
    const inbox = await client.selectMailbox('INBOX')
    console.log(`INBOX has ${inbox.exists} messages`)

    if (!inbox.exists || inbox.exists === 0) {
      await client.disconnect()
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No messages found in inbox',
          tickets: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Search for messages with "[TICKET]" in subject
    console.log('Searching for messages with [TICKET] in subject...')
    
    // IMAP search criteria for subject containing "[TICKET]"
    const ticketMessages = await client.search({
      subject: '[TICKET]'
    })

    console.log(`Found ${ticketMessages.length} messages with [TICKET] in subject`)

    if (ticketMessages.length === 0) {
      await client.disconnect()
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No ticket messages found',
          tickets: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Fetch detailed information for ticket messages
    const ticketDetails = []
    
    for (const messageId of ticketMessages) {
      try {
        const messages = await client.fetch(`${messageId}`, {
          envelope: true,
          headers: ['Subject', 'From', 'To', 'Date', 'Message-ID'],
          flags: true,
        })

        for (const message of messages) {
          const fromEmail = message.envelope?.from?.[0] 
            ? `${message.envelope.from[0].mailbox}@${message.envelope.from[0].host}`
            : 'Unknown'
          
          const toEmail = message.envelope?.to?.[0]
            ? `${message.envelope.to[0].mailbox}@${message.envelope.to[0].host}`
            : 'Unknown'

          const rawMessage = await client.fetch(
            message.seq.toString(),
            { full: true, markSeen: false },
          );
          const content = new TextDecoder().decode(rawMessage[0].parts.TEXT.data)

          ticketDetails.push({
            messageId: message.envelope?.messageId || `seq-${message.seq}`,
            sequenceNumber: message.seq,
            subject: message.envelope?.subject || 'No Subject',
            from: fromEmail,
            to: toEmail,
            date: message.envelope?.date || null,
            flags: message.flags || [],
            isUnread: !message.flags?.includes('\\Seen'),
            messageBody: content || ''
          })
        }
      } catch (fetchError) {
        console.error(`Error fetching message ${messageId}:`, fetchError)
        // Continue with other messages even if one fails
      }
    }

    // Sort by date (newest first)
    ticketDetails.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    console.log(`Successfully retrieved ${ticketDetails.length} ticket messages`)

    // Disconnect from IMAP server
    await client.disconnect()

    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${ticketDetails.length} ticket messages`,
        count: ticketDetails.length,
        tickets: ticketDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in ticket email peek function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        tickets: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})