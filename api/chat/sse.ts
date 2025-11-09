import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SALESFORCE_SCRT_URL } = process.env;

  if (!SALESFORCE_SCRT_URL) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  const token = req.query.token as string;
  const orgId = req.query.orgId as string;
  const lastEventId = req.query.lastEventId as string;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  if (!orgId) {
    return res.status(400).json({ error: 'Missing orgId parameter' });
  }

  if (!lastEventId) {
    return res.status(400).json({ error: 'Missing lastEventId parameter' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial comment to establish connection
  res.write(': connected\n\n');
  
  // Send heartbeat every 15 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);
  
  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('Client disconnected from SSE');
  });

  try {
    const sseUrl = `${SALESFORCE_SCRT_URL}/eventrouter/v1/sse`;
    
    console.log('SSE request:', { url: sseUrl, orgId, lastEventId });
    
    const response = await fetch(sseUrl, {
      headers: {
        'X-Org-Id': orgId,
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'Last-Event-ID': lastEventId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Salesforce SSE error:', response.status, errorText);
      res.write(`data: ${JSON.stringify({ error: `Salesforce SSE error: ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Salesforce SSE stream ended');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('SSE chunk received from Salesforce:', chunk.substring(0, 200));
        
        // Write the chunk
        const written = res.write(chunk);
        console.log('Write successful:', written);
        
        // Force flush if available (Vercel/Node.js specific)
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
        
        // Also try socket-level flush
        if ((res as any).socket && typeof (res as any).socket.flush === 'function') {
          (res as any).socket.flush();
        }
      }
    } finally {
      reader.releaseLock();
      clearInterval(heartbeatInterval);
    }

    res.end();
  } catch (error) {
    console.error('SSE error:', error);
    res.write(`data: ${JSON.stringify({ error: 'SSE connection failed' })}\n\n`);
    res.end();
  }
}

// Disable body parsing and enable streaming for SSE
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 300, // Pro tier: 5 minutes max for streaming
};
