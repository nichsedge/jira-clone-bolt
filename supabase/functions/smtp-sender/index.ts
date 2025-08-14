const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import nodemailer from 'npm:nodemailer@6.9.10'

const transport = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST')!,
  port: Number(Deno.env.get('SMTP_PORT') || '587'),
  secure: Deno.env.get('SMTP_PORT') === '465',
  auth: {
    user: Deno.env.get('SMTP_USER')!,
    pass: Deno.env.get('SMTP_PASS')!
  }
})

console.log(`Function "send-email-smtp" up and running!`)

Deno.serve(async (_req) => {
  try {
    const randomNum = Math.floor(Math.random() * 10) + 1
    
    await new Promise<void>((resolve, reject) => {
      transport.sendMail({
        from: Deno.env.get('SMTP_USER')!,
        to: Deno.env.get('IMAP_USER')!,
        subject: `[TICKET] something ${randomNum}`,
        text: `Hello! This is a test email sent via Ethereal between two accounts.`,
      }, error => {
        if (error) {
          return reject(error)
        }
        resolve()
      })
    })
    
    console.log(`✅ Email sent successfully for Ticket ${randomNum}!`)
    
  } catch (error) {
    return new Response(error.message, { status: 500 })
  }
  
  return new Response(
    JSON.stringify({ done: true }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders, } }
  )
})