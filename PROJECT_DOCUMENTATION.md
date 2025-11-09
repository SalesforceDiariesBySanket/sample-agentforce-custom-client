# Salesforce Agentforce Custom Client - Project Documentation

## Project Overview

This project implements a custom web-based chat client for Salesforce Agentforce using the Salesforce Messaging for In-App and Web API v2. The application provides a real-time chat interface where users can interact with Salesforce AI agents.

**Live Demo**: Deployed on Vercel  
**Technology Stack**: React, TypeScript, Node.js, Vite, TailwindCSS

---

## Architecture

### Frontend (Client)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: React Hooks (useState, useEffect, useCallback)
- **Key Components**:
  - `ChatWindow` - Main chat interface
  - `ChatMessage` - Individual message rendering
  - `ChatInput` - User input handling
  - `ChatHeader` - Chat header with status indicators

### Backend (Server)
- **Runtime**: Node.js with TypeScript
- **Deployment**: Vercel Serverless Functions
- **API Structure**: RESTful endpoints proxying Salesforce Messaging API v2

### API Layer
Six main endpoints handle the chat lifecycle:

1. **Initialize** (`/api/chat/initialize`)
   - Authenticates with Salesforce
   - Creates new conversation
   - Returns access token and conversation ID

2. **Message** (`/api/chat/message`)
   - POST: Sends user messages
   - GET: Retrieves conversation entries

3. **Typing** (`/api/chat/typing`)
   - Sends typing indicators

4. **Conversation** (`/api/chat/conversation`)
   - Retrieves conversation details

5. **SSE** (`/api/chat/sse`)
   - Server-Sent Events endpoint (not used due to Vercel limitations)

6. **End** (`/api/chat/end`)
   - Closes conversation

---

## Salesforce Integration

### API Version
**Salesforce Messaging for In-App and Web API v2**

Base URL: `https://{SALESFORCE_SCRT_URL}/iamessage/api/v2/`

### Authentication Flow

1. **Get Access Token**
   ```
   POST /iamessage/api/v2/token/authorize
   Body: {
     organizationId: process.env.SALESFORCE_ORG_ID,
     developerName: process.env.SALESFORCE_DEVELOPER_NAME
   }
   ```

2. **Extract Organization ID from JWT**
   ```typescript
   const tokenPayload = accessToken.split('.')[1];
   const decoded = JSON.parse(Buffer.from(tokenPayload, 'base64').toString());
   const orgId = decoded.orgId; // 15-character format
   ```

3. **Create Conversation**
   ```
   POST /iamessage/api/v2/conversation
   Headers: Authorization: Bearer {token}
   Body: { conversationId: crypto.randomUUID() }
   ```

### Key Integration Points

- **Organization ID**: JWT token contains 15-character orgId (e.g., `00DXXXXXXXXXXXXP`)
- **Conversation ID**: Must be lowercase UUID format
- **Message Structure**: Uses `entryPayload` with `abstractMessage.staticContent.text`
- **Event Types**: `CONVERSATION_MESSAGE`, `TYPING_STARTED_INDICATOR`, `TYPING_STOPPED_INDICATOR`, `PARTICIPANT_CHANGED`

---

## Environment Variables

### Required Configuration

```bash
# Salesforce Configuration
SALESFORCE_SCRT_URL=your-salesforce-scrt-url
SALESFORCE_ORG_ID=your-18-char-org-id
SALESFORCE_DEVELOPER_NAME=CustomClientNode

# API Configuration
API_URL=http://localhost:3000
```

### Vercel Deployment
All environment variables must be configured in Vercel Project Settings.

---

## Key Technical Challenges & Solutions

### 1. Salesforce API v1 to v2 Migration

**Challenge**: Initial implementation used deprecated v1 endpoints.

**Solution**: Migrated all 6 endpoints to v2 format:
- Updated endpoint paths from `/iamessage/api/v1/` to `/iamessage/api/v2/`
- Updated request/response structures
- Changed authentication flow

### 2. Conversation ID Format

**Challenge**: Salesforce requires lowercase UUID format for conversationId.

**Error**: `"Specify the conversationId in UUID format. The UUID must be in lowercase."`

**Solution**: 
```typescript
const conversationId = crypto.randomUUID(); // Generates lowercase UUID
```

### 3. Organization ID Mismatch

**Challenge**: Environment variable contains 18-character orgId (`00DgL0000044OAPUA2`), but Salesforce JWT token contains 15-character format (`00DgL0000044OAP`).

**Solution**: Extract orgId from JWT token instead of using environment variable:
```typescript
const tokenPayload = data.accessToken.split('.')[1];
const decoded = JSON.parse(Buffer.from(tokenPayload, 'base64').toString());
const orgId = decoded.orgId; // Use this for SSE and other API calls
```

### 4. Server-Sent Events (SSE) on Vercel

**Challenge**: Vercel serverless functions buffer responses, preventing true SSE streaming to browser.

**Symptoms**:
- Server-side logs show successful event reception from Salesforce
- `res.write()` returns `true` indicating successful writes
- Browser `EventSource` opens connection but never receives data
- ReadyState = 1 (OPEN) but `onmessage` never fires

**Attempted Solutions**:
- ✗ Edge Runtime (`export const runtime = 'edge'`)
- ✗ Aggressive response flushing
- ✗ External resolver pattern
- ✗ Increased timeout (`maxDuration: 300`)
- ✗ Vercel Pro tier upgrade

**Root Cause**: Fundamental Vercel platform limitation - serverless functions buffer responses regardless of configuration.

**Final Solution**: **Polling-based approach**
```typescript
// Poll every 2 seconds
const pollMessages = async () => {
  const response = await fetch(`${API_URL}/chat/message`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Conversation-Id': conversationId
    }
  });
  const data = await response.json();
  
  // Filter for bot messages
  const botEntries = data.conversationEntries.filter(
    entry => entry.entryType === "Message" && entry.sender.role === "Chatbot"
  );
  
  // Update state with deduplication
  botEntries.forEach(entry => {
    const payload = JSON.parse(entry.entryPayload);
    const messageText = payload.abstractMessage.staticContent.text;
    const messageId = payload.abstractMessage.id;
    
    setMessages(prev => {
      if (prev.find(m => m.id === messageId)) return prev;
      return [...prev, { id: messageId, type: "ai", content: messageText }];
    });
  });
};

pollingRef.current = setInterval(pollMessages, 2000);
pollMessages(); // Immediate first poll
```

### 5. Message Deduplication

**Challenge**: Polling could retrieve the same messages multiple times.

**Solution**: Check message ID before adding:
```typescript
setMessages(prev => {
  if (prev.find(m => m.id === messageId)) return prev;
  return [...prev, newMessage];
});
```

---

## Project Structure

```
sample-agentforce-custom-client/
├── api/                          # Vercel serverless functions
│   └── chat/
│       ├── initialize.ts         # Auth & conversation creation
│       ├── message.ts            # Send/receive messages
│       ├── conversation.ts       # Get conversation details
│       ├── typing.ts             # Typing indicators
│       ├── sse.ts                # SSE endpoint (unused)
│       └── end.ts                # Close conversation
│
├── client/                       # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── chat/
│   │   │       ├── ChatWindow.tsx
│   │   │       ├── ChatMessage.tsx
│   │   │       ├── ChatInput.tsx
│   │   │       ├── ChatHeader.tsx
│   │   │       └── ChatMessageList.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts        # Main chat logic
│   │   │   └── useSalesforceMessaging.ts
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                       # Local development server
│   └── src/
│       ├── index.ts
│       ├── routes.ts
│       └── handlers/
│
├── package.json                  # Root package
├── pnpm-workspace.yaml
├── vercel.json                   # Vercel configuration
└── README.md
```

---

## Message Flow

### 1. User Sends Message

```
User Input → ChatInput component
  ↓
useChat.sendMessage()
  ↓
POST /api/chat/message
  ↓
Salesforce API v2
  ↓
200 OK
```

### 2. Bot Response (Polling)

```
setInterval (2000ms)
  ↓
GET /api/chat/message
  ↓
Salesforce API v2
  ↓
Filter conversationEntries for role="Chatbot"
  ↓
Parse entryPayload → abstractMessage.staticContent.text
  ↓
Deduplicate by message ID
  ↓
Update React state
  ↓
Render in ChatMessage component
```

### 3. Complete Conversation Flow

1. **Initialize**: `POST /api/chat/initialize`
   - Get access token
   - Extract orgId from JWT
   - Create conversation with UUID
   - Return credentials

2. **Start Polling**: Begin 2-second interval

3. **User Message**: `POST /api/chat/message`
   - Send message with conversationId
   - Salesforce routes to agent

4. **Poll Response**: `GET /api/chat/message`
   - Retrieve all entries
   - Filter for bot messages
   - Update UI

5. **Close**: `POST /api/chat/end`
   - End conversation
   - Clear polling interval

---

## Data Structures

### Message Type
```typescript
interface Message {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
}
```

### Conversation Entry (Salesforce Response)
```typescript
interface ConversationEntry {
  entryType: "Message" | "ParticipantChanged";
  sender: {
    role: "EndUser" | "Chatbot" | "Agent";
    appType: string;
  };
  entryPayload: string; // JSON string
  clientTimestamp: string;
}
```

### Entry Payload (Bot Message)
```typescript
interface EntryPayload {
  abstractMessage: {
    id: string;
    staticContent: {
      text: string;
      formatType: "PlainText" | "RichText";
    };
  };
}
```

### API Credentials
```typescript
interface Credentials {
  accessToken: string;      // JWT from Salesforce
  conversationId: string;   // Lowercase UUID
  orgId: string;           // 15-character from JWT
  lastEventId?: string;    // For SSE (not used)
}
```

---

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- Salesforce org with Agentforce configured

### Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/SalesforceDiariesBySanket/sample-agentforce-custom-client.git
   cd sample-agentforce-custom-client
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment**
   ```bash
   # Create .env file
   SALESFORCE_SCRT_URL=your-url
   SALESFORCE_ORG_ID=your-org-id
   SALESFORCE_DEVELOPER_NAME=CustomClientNode
   ```

4. **Run Development Server**
   ```bash
   pnpm dev
   ```

5. **Build for Production**
   ```bash
   pnpm build
   ```

### Testing

#### Manual Testing with cURL

**1. Initialize Conversation**
```bash
curl -X POST https://your-app.vercel.app/api/chat/initialize
```

**2. Send Message**
```bash
curl -X POST https://your-app.vercel.app/api/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Conversation-Id: YOUR_UUID" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hi"}'
```

**3. Get Messages**
```bash
curl https://your-app.vercel.app/api/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Conversation-Id: YOUR_UUID"
```

---

## Deployment

### Vercel Deployment

1. **Connect Repository**
   - Link GitHub repository to Vercel
   - Auto-deploy on push to main

2. **Configure Build Settings**
   ```json
   {
     "buildCommand": "cd client && pnpm build",
     "outputDirectory": "client/dist",
     "installCommand": "pnpm install"
   }
   ```

3. **Set Environment Variables**
   - Add all required variables in Vercel dashboard
   - Redeploy after changes

4. **Deployment Configuration** (`vercel.json`)
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "/api/:path*" },
       { "source": "/(.*)", "destination": "/client/dist/$1" }
     ],
     "functions": {
       "api/**/*.ts": {
         "maxDuration": 30
       }
     }
   }
   ```

---

## Debugging

### Browser Console Logs

The application includes comprehensive logging:

```typescript
// Initialization
console.log('Chat initialized:', { conversationId, orgId, lastEventId });

// Polling
console.log('Polling response:', data);
console.log('Found bot entries:', entries.length);
console.log('Bot message:', messageText);

// Errors
console.error('Failed to send message:', error);
```

### Common Issues

#### 1. "Failed to fetch"
- Check CORS configuration
- Verify API endpoints are accessible
- Check Vercel function logs

#### 2. "Specify the conversationId in UUID format"
- Ensure using `crypto.randomUUID()`
- Verify lowercase format

#### 3. No bot responses
- Check polling is running (console logs)
- Verify conversation entries in API response
- Check message filtering logic

#### 4. Messages not displaying
- Check deduplication logic
- Verify message ID uniqueness
- Check React state updates

---

## Performance Optimizations

### 1. Polling Interval
- **Current**: 2 seconds
- **Trade-off**: Lower = more responsive, higher server load
- **Recommended**: 1-3 seconds for real-time feel

### 2. Message Deduplication
- Prevents duplicate renders
- Uses message ID for comparison
- Efficient array filtering

### 3. React Optimizations
- `useCallback` for stable function references
- `useRef` for mutable values without re-renders
- Conditional state updates to prevent unnecessary renders

---

## Security Considerations

### 1. Access Token Handling
- Stored in React refs (not exposed in state)
- Never logged to console in production
- Short-lived tokens from Salesforce

### 2. CORS Configuration
- Properly configured for Vercel deployment
- Restricts origins in production

### 3. Environment Variables
- Never committed to repository
- Managed through Vercel dashboard
- Server-side only (not exposed to client)

---

## Future Enhancements

### Potential Improvements

1. **WebSocket Support**
   - If moving away from Vercel
   - True real-time bidirectional communication

2. **Message Persistence**
   - Store conversation history
   - Resume previous conversations

3. **Rich Media Support**
   - File uploads
   - Images and attachments
   - Formatted messages

4. **Typing Indicators**
   - Show when bot is typing
   - User typing notifications

5. **Error Recovery**
   - Automatic reconnection
   - Message retry logic
   - Offline support

6. **Analytics**
   - Track conversation metrics
   - User engagement analytics
   - Bot performance monitoring

---

## Lessons Learned

### 1. Platform Limitations
- Always verify platform capabilities early
- SSE doesn't work on all serverless platforms
- Polling is a reliable fallback

### 2. API Version Compatibility
- Stay updated with Salesforce API versions
- Test thoroughly when migrating versions
- Read documentation carefully (v1 vs v2 differences)

### 3. Token Handling
- JWT tokens contain important metadata
- Don't rely solely on environment variables
- Extract and use actual token values

### 4. Debugging Strategy
- Comprehensive logging is invaluable
- Server-side vs client-side distinction
- cURL testing validates API independently

---

## References

### Documentation
- [Salesforce Messaging for In-App and Web API v2](https://developer.salesforce.com/docs/service/messaging-in-app-web/guide/api-overview.html)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

### Tools Used
- Visual Studio Code
- GitHub Copilot
- Vercel CLI
- pnpm
- Git

---

## Contributing

### Development Workflow

1. Create feature branch
2. Make changes
3. Test locally
4. Commit with descriptive message
5. Push and create PR
6. Deploy via Vercel preview

### Commit Message Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation update
refactor: Code refactoring
chore: Maintenance tasks
```

---

## License

See LICENSE file for details.

---

## Contact & Support

**Repository**: https://github.com/SalesforceDiariesBySanket/sample-agentforce-custom-client

**Maintained by**: Salesforce Diaries By Sanket

---

## Changelog

### Latest Updates (November 2025)

- ✅ Migrated all endpoints to Salesforce API v2
- ✅ Fixed UUID format for conversationId
- ✅ Implemented orgId extraction from JWT
- ✅ Switched from SSE to polling due to Vercel limitations
- ✅ Added message deduplication
- ✅ Removed unused SSE code
- ✅ Comprehensive debugging and logging
- ✅ Successful Vercel deployment

---

*Last Updated: November 9, 2025*
