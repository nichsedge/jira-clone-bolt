// supabase/functions/read-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface EmailFilter {
  filter_by?: 'today' | 'date_range' | 'all'
  start_date?: string // ISO date string
  end_date?: string   // ISO date string
  mark_as_read?: boolean
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      } 
    })
  }

  try {
    const body = req.method === 'POST' ? await req.json() : {}
    const {
      filter_by = 'today',
      start_date,
      end_date,
      mark_as_read = false
    }: EmailFilter = body

    // Get credentials from environment
    const emailAddress = Deno.env.get('GMAIL_EMAIL')
    const appPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!emailAddress || !appPassword) {
      return new Response(
        JSON.stringify({ error: 'Gmail credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Connect to IMAP server
    const conn = await Deno.connectTls({
      hostname: "imap.gmail.com",
      port: 993,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    let tagCounter = 1
    const getTag = () => `A${tagCounter++}`

    // Helper function to send IMAP command
    const sendCommand = async (command: string) => {
      const tag = getTag()
      const fullCommand = `${tag} ${command}\r\n`
      await conn.write(encoder.encode(fullCommand))
      
      let response = ""
      let buffer = new Uint8Array(4096)
      
      while (true) {
        const n = await conn.read(buffer)
        if (!n) break
        
        response += decoder.decode(buffer.subarray(0, n))
        
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
          break
        }
      }
      
      return { tag, response }
    }

    // Wait for server greeting
    let buffer = new Uint8Array(1024)
    await conn.read(buffer)

    // Login
    const { response: loginResp } = await sendCommand(`LOGIN "${emailAddress}" "${appPassword}"`)
    if (!loginResp.includes('OK')) {
      throw new Error(`Login failed: ${loginResp}`)
    }

    // Select INBOX
    const { response: selectResp } = await sendCommand('SELECT INBOX')
    if (!selectResp.includes('OK')) {
      throw new Error(`Select INBOX failed: ${selectResp}`)
    }

    // Build search criteria
    let searchCriteria = 'UNSEEN'
    
    if (filter_by === 'today') {
      const today = new Date()
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const day = today.getDate().toString().padStart(2, '0')
      const month = months[today.getMonth()]
      const year = today.getFullYear()
      const formattedDate = `${day}-${month}-${year}`
      searchCriteria += ` SENTSINCE ${formattedDate}`
    } else if (filter_by === 'date_range') {
      if (!start_date || !end_date) {
        throw new Error('start_date and end_date required for date_range filter')
      }
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const day = date.getDate().toString().padStart(2, '0')
        const month = months[date.getMonth()]
        const year = date.getFullYear()
        return `${day}-${month}-${year}`
      }
      searchCriteria += ` SENTSINCE ${formatDate(start_date)} SENTBEFORE ${formatDate(end_date)}`
    }

    // Search for emails
    console.log(`Search criteria: ${searchCriteria}`)
    const { response: searchResp } = await sendCommand(`SEARCH ${searchCriteria}`)
    console.log(`Search response: ${searchResp}`)
    
    const emailIds = searchResp
      .split('\n')
      .find(line => line.includes('SEARCH'))
      ?.replace(/.*SEARCH\s+/, '')
      ?.trim()
      ?.split(' ')
      ?.filter(id => id && !isNaN(parseInt(id))) || []

    console.log(`Found email IDs: ${emailIds}`)

    // Try searching for just UNSEEN if no results with date filter
    if (emailIds.length === 0 && searchCriteria !== 'UNSEEN') {
      console.log('No emails found with date filter, trying UNSEEN only')
      const { response: unseenResp } = await sendCommand('SEARCH UNSEEN')
      console.log(`UNSEEN search response: ${unseenResp}`)
      const unseenIds = unseenResp
        .split('\n')
        .find(line => line.includes('SEARCH'))
        ?.replace(/.*SEARCH\s+/, '')
        ?.trim()
        ?.split(' ')
        ?.filter(id => id && !isNaN(parseInt(id))) || []
      console.log(`UNSEEN email IDs: ${unseenIds}`)
    }

    const emails = []

    // Fetch emails (limit to 10)
    for (const emailId of emailIds.slice(0, 10)) {
      try {
        console.log(`Fetching email ID: ${emailId}`)
        const fetchCmd = mark_as_read ? `FETCH ${emailId} (RFC822)` : `FETCH ${emailId} (BODY.PEEK[])`
        const { response: fetchResp } = await sendCommand(fetchCmd)
        console.log(`Fetch response length: ${fetchResp.length}`)
        
        // Parse email from response
        const emailData = parseEmailFromResponse(fetchResp)
        console.log(`Parsed email data:`, emailData)
        if (emailData) {
          emails.push({
            id: emailId,
            ...emailData
          })
        }

        // Mark as read if requested and we used PEEK
        if (mark_as_read && fetchCmd.includes('PEEK')) {
          await sendCommand(`STORE ${emailId} +FLAGS (\\Seen)`)
        }
      } catch (err) {
        console.error(`Error fetching email ${emailId}:`, err)
      }
    }

    // Logout
    await sendCommand('LOGOUT')
    conn.close()

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: emails.length,
        emails: emails 
      }),
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

function parseEmailFromResponse(response: string) {
  try {
    // Look for BODY[] or RFC822 content
    let emailStart = response.indexOf('BODY[]')
    if (emailStart === -1) {
      emailStart = response.indexOf('RFC822')
    }
    if (emailStart === -1) {
      return null
    }
    
    // Find the opening brace and size
    const braceStart = response.indexOf('{', emailStart)
    if (braceStart === -1) {
      return null
    }
    
    const braceEnd = response.indexOf('}', braceStart)
    if (braceEnd === -1) {
      return null
    }
    
    // Skip to the actual email content after the size info
    const emailContentStart = response.indexOf('\r\n', braceEnd) + 2
    const emailContent = response.substring(emailContentStart)
    
    // Find end of headers
    const headerEndIndex = emailContent.indexOf('\r\n\r\n')
    if (headerEndIndex === -1) {
      return null
    }
    
    const headers = emailContent.substring(0, headerEndIndex)
    const fullBody = emailContent.substring(headerEndIndex + 4)
    
    // Parse headers
    const headerLines = headers.split('\r\n')
    let from = ''
    let subject = ''
    let contentType = ''
    
    for (let i = 0; i < headerLines.length; i++) {
      let line = headerLines[i]
      
      // Handle folded headers (continuation lines start with space/tab)
      while (i + 1 < headerLines.length && (headerLines[i + 1].startsWith(' ') || headerLines[i + 1].startsWith('\t'))) {
        line += headerLines[i + 1]
        i++
      }
      
      const lowerLine = line.toLowerCase()
      if (lowerLine.startsWith('from:')) {
        from = line.substring(5).trim()
      } else if (lowerLine.startsWith('subject:')) {
        subject = line.substring(8).trim()
      } else if (lowerLine.startsWith('content-type:')) {
        contentType = line.substring(13).trim()
      }
    }
    
    // Extract readable body content
    let readableBody = extractReadableBody(fullBody, contentType)
    
    return {
      from,
      subject,
      body: readableBody
    }
  } catch (err) {
    console.error('Error parsing email:', err)
    return null
  }
}

function extractReadableBody(body: string, contentType: string): string {
  try {
    // If it's multipart, find the text/plain part
    if (contentType.toLowerCase().includes('multipart')) {
      const parts = body.split(/--[\w\d]+/)
      
      for (const part of parts) {
        if (part.includes('Content-Type: text/plain')) {
          const partHeaderEnd = part.indexOf('\r\n\r\n')
          if (partHeaderEnd !== -1) {
            let partBody = part.substring(partHeaderEnd + 4)
            
            // Check if it's base64 encoded
            if (part.includes('Content-Transfer-Encoding: base64')) {
              try {
                partBody = atob(partBody.replace(/\r\n/g, ''))
              } catch (e) {
                console.log('Failed to decode base64:', e)
              }
            }
            // Check if it's quoted-printable
            else if (part.includes('Content-Transfer-Encoding: quoted-printable')) {
              partBody = decodeQuotedPrintable(partBody)
            }
            
            return partBody.substring(0, 500).trim()
          }
        }
      }
    }
    
    // For simple text emails, check encoding
    if (contentType.toLowerCase().includes('text/plain')) {
      // If base64 encoded
      if (body.includes('Content-Transfer-Encoding: base64')) {
        try {
          const lines = body.split('\r\n')
          const bodyStart = lines.findIndex(line => line === '') + 1
          const encodedContent = lines.slice(bodyStart).join('')
          return atob(encodedContent).substring(0, 500).trim()
        } catch (e) {
          console.log('Failed to decode base64:', e)
        }
      }
      // If quoted-printable
      else if (body.includes('Content-Transfer-Encoding: quoted-printable')) {
        return decodeQuotedPrintable(body).substring(0, 500).trim()
      }
    }
    
    // Return first 500 chars as fallback
    return body.substring(0, 500).trim()
  } catch (err) {
    console.error('Error extracting body:', err)
    return body.substring(0, 500).trim()
  }
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/=E2=80=99/g, "'") // Common Unicode replacements
    .replace(/=E2=80=93/g, "–")
    .replace(/=E2=80=AF/g, " ")
    .replace(/=C2=A0/g, " ")
}