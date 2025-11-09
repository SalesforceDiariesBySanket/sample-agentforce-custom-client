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

  const { SALESFORCE_SCRT_URL, SALESFORCE_ORG_ID, SALESFORCE_DEVELOPER_NAME } = process.env;

  if (!SALESFORCE_SCRT_URL || !SALESFORCE_ORG_ID || !SALESFORCE_DEVELOPER_NAME) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  if (req.method === 'POST') {
    // Send message
    const token = req.headers.authorization?.replace('Bearer ', '');
    const conversationId = req.headers['x-conversation-id'] as string;
    const { message } = req.body;

    if (!token || !conversationId || !message) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      // Generate unique message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await fetch(
        `${SALESFORCE_SCRT_URL}/iamessage/api/v2/conversation/${conversationId}/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: {
              id: messageId,
              messageType: 'StaticContentMessage',
              staticContent: {
                formatType: 'Text',
                text: message,
              },
            },
            esDeveloperName: SALESFORCE_DEVELOPER_NAME,
            isNewMessagingSession: false,
            language: ''
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Salesforce error:', errorText);
        throw new Error(`Salesforce API error: ${response.status}`);
      }

      res.status(200).json({ success: true, messageId });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  } else if (req.method === 'GET') {
    // Get messages (list conversation entries)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const conversationId = req.headers['x-conversation-id'] as string;

    if (!token || !conversationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      const response = await fetch(
        `${SALESFORCE_SCRT_URL}/iamessage/api/v2/conversation/${conversationId}/entries`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Salesforce error:', errorText);
        throw new Error(`Salesforce API error: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
