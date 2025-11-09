# Vercel Deployment Fix Guide

## The Problem

Your Vercel deployment at https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app/ is showing a "Failed to fetch" error because:

1. ❌ The API endpoints were not deployed (only the client frontend was deployed)
2. ❌ Environment variables are missing in Vercel
3. ❌ The client is trying to connect to `http://localhost:8080/api` instead of your Vercel API

## The Solution

I've created serverless API functions in the `/api` directory that will run on Vercel. Now you need to:

### Step 1: Install API Dependencies

Run this command in your project root:

```bash
cd api
pnpm install
cd ..
```

### Step 2: Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: `sample-agentforce-custom-client`
3. Go to **Settings** → **Environment Variables**
4. Add these 4 variables (for **Production**, **Preview**, and **Development**):

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `SALESFORCE_SCRT_URL` | `https://your-domain.my.salesforce-scrt.com` | From your Salesforce Messaging for In-App and Web setup |
| `SALESFORCE_ORG_ID` | Your 18-character Org ID | From Salesforce Setup → Company Information |
| `SALESFORCE_DEVELOPER_NAME` | Your custom client name | From your Custom Client setup in Salesforce |
| `VITE_API_URL` | `https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app/api` | Your Vercel deployment URL + `/api` |

**Important:** 
- Make sure to check ALL three environment types: Production, Preview, Development
- Do NOT include trailing slashes in URLs
- Your actual Vercel URL is: `https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app`

### Step 3: Commit and Push Changes

```bash
git add .
git commit -m "Add Vercel serverless API functions and fix deployment configuration"
git push
```

### Step 4: Verify Deployment

Once Vercel redeploys (automatically after push):

1. Visit: https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app/api/chat/initialize
2. You should see either:
   - A JSON response with `accessToken` and `conversationId` (SUCCESS ✅)
   - An error message about environment variables (you need to set them in Vercel)

### Step 5: Test Your Chat

After the deployment completes and environment variables are set:

1. Go to: https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app/
2. The chat should initialize automatically
3. Try sending a message

## Files Created/Modified

✅ Created serverless API functions:
- `/api/chat/initialize.ts` - Initialize chat sessions
- `/api/chat/message.ts` - Send/receive messages
- `/api/chat/end.ts` - End chat sessions
- `/api/chat/sse.ts` - Server-sent events for real-time updates
- `/api/chat/typing.ts` - Typing indicators
- `/api/package.json` - API dependencies
- `/api/tsconfig.json` - TypeScript configuration

✅ Updated configuration:
- `vercel.json` - Added API rewrites and CORS headers
- `server/src/index.ts` - Updated CORS to allow Vercel domains
- `VERCEL_DEPLOY.md` - Updated deployment instructions

## Troubleshooting

### "Failed to fetch" error persists
- Check that environment variables are set in Vercel (all 4 of them)
- Make sure `VITE_API_URL` points to your Vercel URL with `/api`
- Check Vercel deployment logs for errors

### "Missing required environment variables" error
- You need to add the Salesforce credentials in Vercel dashboard
- Make sure to select all environments when adding variables

### API endpoints return 404
- Make sure your changes are committed and pushed
- Check the Vercel deployment logs
- Verify the `/api` folder exists in your repository

### CORS errors
- The configuration should now allow your Vercel domain
- If you see CORS errors, check the browser console for the exact origin

## Getting Salesforce Credentials

### SALESFORCE_SCRT_URL
1. In Salesforce Setup, search for "Messaging for In-App and Web"
2. Find your custom client deployment
3. Copy the SCRT URL (looks like `https://xxxxx.my.salesforce-scrt.com`)

### SALESFORCE_ORG_ID
1. In Salesforce Setup, search for "Company Information"
2. Copy the Organization ID (18-character ID)

### SALESFORCE_DEVELOPER_NAME
1. In Salesforce Setup, search for "Messaging for In-App and Web"
2. Find your custom client
3. Copy the Developer Name (API Name)

## Need Help?

If you're still having issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Make sure your Salesforce setup is complete
