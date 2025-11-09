import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Conversation-Id'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SALESFORCE_SCRT_URL, SALESFORCE_ORG_ID } = process.env;

  if (!SALESFORCE_SCRT_URL || !SALESFORCE_ORG_ID) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const conversationId = req.headers['x-conversation-id'] as string;
  const { isTyping } = req.body;

  if (!token || !conversationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Generate unique entry ID in UUID format  
    const entryId = `${crypto.randomUUID()}`;
    
    const response = await fetch(
      `${SALESFORCE_SCRT_URL}/iamessage/api/v2/conversation/${conversationId}/entry`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entryType: isTyping ? 'TypingStartedIndicator' : 'TypingStoppedIndicator',
          id: entryId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Salesforce error:', errorText);
      throw new Error(`Salesforce API error: ${response.status}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Typing indicator error:', error);
    res.status(500).json({ error: 'Failed to send typing indicator' });
  }
}
