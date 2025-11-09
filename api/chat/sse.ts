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

  const { SALESFORCE_SCRT_URL, SALESFORCE_ORG_ID } = process.env;

  if (!SALESFORCE_SCRT_URL || !SALESFORCE_ORG_ID) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  const token = req.query.token as string;
  const lastEventId = req.query.lastEventId as string;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  if (!lastEventId) {
    return res.status(400).json({ error: 'Missing lastEventId parameter' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const sseUrl = `${SALESFORCE_SCRT_URL}/eventrouter/v1/sse?lastEventId=${lastEventId}`;
    
    const response = await fetch(sseUrl, {
      headers: {
        'X-Org-Id': SALESFORCE_ORG_ID,
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Salesforce SSE error: ${response.status}`);
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
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (error) {
    console.error('SSE error:', error);
    res.write(`data: ${JSON.stringify({ error: 'SSE connection failed' })}\n\n`);
    res.end();
  }
}

// Disable body parsing for streaming
export const config = {
  api: {
    bodyParser: false,
  },
};
