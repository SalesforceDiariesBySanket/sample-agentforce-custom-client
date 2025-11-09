import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel serverless function to create conversation
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

  const { SALESFORCE_SCRT_URL, SALESFORCE_DEVELOPER_NAME } = process.env;

  if (!SALESFORCE_SCRT_URL || !SALESFORCE_DEVELOPER_NAME) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const { conversationId, routingAttributes } = req.body;

  if (!token || !conversationId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const response = await fetch(
      `${SALESFORCE_SCRT_URL}/iamessage/api/v2/conversation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          ...(routingAttributes && { routingAttributes }),
          esDeveloperName: SALESFORCE_DEVELOPER_NAME,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Salesforce error:', errorText);
      throw new Error(`Salesforce API error: ${response.status}`);
    }

    res.status(200).json({ success: true, conversationId });
  } catch (error) {
    console.error('Create conversation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to create conversation',
      details: errorMessage
    });
  }
}
