// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface EmailRequest {
  to: string
  subject?: string
  body?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      } 
    })
  }

  try {
    const { to, subject = 'Email from Supabase Edge Function', body = 'This is a test email.' }: EmailRequest = await req.json()
    
    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get credentials from environment
    const senderEmail = Deno.env.get('GMAIL_EMAIL')
    const appPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!senderEmail || !appPassword) {
      return new Response(
        JSON.stringify({ error: 'Gmail credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // SMTP connection to Gmail
    const conn = await Deno.connect({
      hostname: "smtp.gmail.com",
      port: 587,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Helper function to send command and read response
    const sendCommand = async (command: string) => {
      await conn.write(encoder.encode(command + "\r\n"))
      const buffer = new Uint8Array(1024)
      const n = await conn.read(buffer)
      return decoder.decode(buffer.subarray(0, n || 0))
    }

    // Read server greeting first
    const buffer = new Uint8Array(1024)
    const n = await conn.read(buffer)
    const greeting = decoder.decode(buffer.subarray(0, n || 0))
    if (!greeting.startsWith("220")) {
      throw new Error(`Server greeting failed: ${greeting}`)
    }

    // SMTP handshake
    let response = await sendCommand("EHLO localhost")
    if (!response.startsWith("250")) {
      throw new Error(`EHLO failed: ${response}`)
    }

    // Start TLS
    response = await sendCommand("STARTTLS")
    if (!response.startsWith("220")) {
      throw new Error(`STARTTLS failed: ${response}`)
    }

    // Upgrade to TLS connection
    const tlsConn = await Deno.startTls(conn, { hostname: "smtp.gmail.com" })

    const tlsSend = async (command: string) => {
      await tlsConn.write(encoder.encode(command + "\r\n"))
      const buffer = new Uint8Array(1024)
      const n = await tlsConn.read(buffer)
      return decoder.decode(buffer.subarray(0, n || 0))
    }

    // EHLO again after TLS
    response = await tlsSend("EHLO localhost")
    if (!response.startsWith("250")) {
      throw new Error(`EHLO after TLS failed: ${response}`)
    }

    // Authentication
    const auth = btoa(`\0${senderEmail}\0${appPassword}`)
    response = await tlsSend("AUTH PLAIN " + auth)
    if (!response.startsWith("235")) {
      throw new Error(`Authentication failed: ${response}`)
    }

    // Send email
    response = await tlsSend(`MAIL FROM:<${senderEmail}>`)
    if (!response.startsWith("250")) {
      throw new Error(`MAIL FROM failed: ${response}`)
    }

    response = await tlsSend(`RCPT TO:<${to}>`)
    if (!response.startsWith("250")) {
      throw new Error(`RCPT TO failed: ${response}`)
    }

    response = await tlsSend("DATA")
    if (!response.startsWith("354")) {
      throw new Error(`DATA failed: ${response}`)
    }

    const emailMessage = [
      `From: ${senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      ``,
      body,
      `.`
    ].join("\r\n")

    response = await tlsSend(emailMessage)
    if (!response.startsWith("250")) {
      throw new Error(`Message send failed: ${response}`)
    }

    await tlsSend("QUIT")
    tlsConn.close()

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}` }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})