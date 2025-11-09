import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

// Vercel serverless function to initialize chat with Salesforce
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SALESFORCE_SCRT_URL, SALESFORCE_ORG_ID, SALESFORCE_DEVELOPER_NAME } = process.env;

  if (!SALESFORCE_SCRT_URL || !SALESFORCE_ORG_ID || !SALESFORCE_DEVELOPER_NAME) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  console.log('Environment check:', {
    hasScrtUrl: !!SALESFORCE_SCRT_URL,
    hasOrgId: !!SALESFORCE_ORG_ID,
    hasDeveloperName: !!SALESFORCE_DEVELOPER_NAME,
    orgIdLength: SALESFORCE_ORG_ID?.length,
    developerName: SALESFORCE_DEVELOPER_NAME
  });

  const requestBody = {
    orgId: SALESFORCE_ORG_ID,
    esDeveloperName: SALESFORCE_DEVELOPER_NAME,
    capabilitiesVersion: '1',
    platform: 'Web',
    context: {
      appName: 'agentforce_custom_client',
      clientVersion: '1.0.0'
    }
  };

  console.log('Making request to Salesforce:', {
    url: `${SALESFORCE_SCRT_URL}/iamessage/api/v2/authorization/unauthenticated/access-token`,
    body: requestBody
  });

  try {
    const response = await fetch(`${SALESFORCE_SCRT_URL}/iamessage/api/v2/authorization/unauthenticated/access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Salesforce response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Salesforce error response:', errorBody);
      throw new Error(`Salesforce API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Generate a conversationId and create the conversation
    const conversationId = randomUUID();
    console.log('Creating conversation with ID:', conversationId);
    
    const conversationResponse = await fetch(`${SALESFORCE_SCRT_URL}/iamessage/api/v2/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.accessToken}`,
      },
      body: JSON.stringify({
        conversationId: conversationId,
        esDeveloperName: SALESFORCE_DEVELOPER_NAME,
      }),
    });
    
    console.log('Conversation creation response status:', conversationResponse.status);
    
    if (!conversationResponse.ok) {
      const errorBody = await conversationResponse.text();
      console.error('Conversation creation error:', errorBody);
      throw new Error(`Failed to create conversation: ${conversationResponse.status}`);
    }
    
    // Return both the access token and conversationId
    res.status(200).json({
      accessToken: data.accessToken,
      conversationId: conversationId,
    });
  } catch (error) {
    console.error('Initialize error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to initialize chat',
      details: errorMessage,
      url: SALESFORCE_SCRT_URL 
    });
  }
}
