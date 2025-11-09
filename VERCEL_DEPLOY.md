# Vercel Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Prerequisites
- GitHub account
- Vercel account (free)
- Salesforce org with Agentforce configured

### 2. Deploy to Vercel

#### Option A: GitHub Integration (Recommended)
1. Push this code to your GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" 
4. Import your GitHub repository
5. Vercel will auto-detect the configuration

#### Option B: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from this directory
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: agentforce-custom-client
# - Directory: ./
# - Override settings? No
```

### 3. Configure Environment Variables

In your Vercel dashboard, go to **Settings → Environment Variables** and add the following:

**Required Environment Variables (Production, Preview, and Development):**

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `SALESFORCE_SCRT_URL` | Your Salesforce SCRT URL from Messaging for In-App and Web | `https://your-domain.my.salesforce-scrt.com` |
| `SALESFORCE_ORG_ID` | Your Salesforce Organization ID (18-character) | `00D8c0000008gEyEAI` |
| `SALESFORCE_DEVELOPER_NAME` | Your Custom Client Developer Name | `MyCustomClient` |
| `VITE_API_URL` | Your Vercel deployment URL with /api | `https://your-app.vercel.app/api` |

**How to set environment variables:**
1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable with its value
4. Select all environments (Production, Preview, Development)
5. Click **Save**

**Important Notes:**
- Do NOT include trailing slashes in URLs
- `VITE_API_URL` should point to your Vercel deployment (e.g., `https://sample-agentforce-custom-client-ja9k4ud3q.vercel.app/api`)
- Make sure to add variables to ALL environments (Production, Preview, Development)

### 4. Redeploy
After adding environment variables, trigger a new deployment:
- Push a new commit, or
- Go to Vercel dashboard → Deployments → Redeploy

## 🔧 What Was Done

This repository has been configured for Vercel deployment with:

1. **Serverless API Functions** (`/api` directory)
   - `api/chat/initialize.ts` - Initialize chat session
   - `api/chat/message.ts` - Send and receive messages
   - `api/chat/end.ts` - End chat session
   - `api/chat/sse.ts` - Server-sent events for real-time updates
   - `api/chat/typing.ts` - Typing indicators

2. **Vercel Configuration** (`vercel.json`)
   - API route rewrites
   - CORS headers configuration
   - Build and output directory settings

3. **Environment Variables**
   - Salesforce API credentials
   - Client API URL configuration

## 📝 Next Steps

1. Get your Salesforce credentials:
   - SCRT URL from your Messaging for In-App and Web setup
   - Org ID from your Salesforce org
   - Developer Name from your custom client configuration

2. Update environment variables in Vercel dashboard

3. Test your deployment!

## 🐛 Troubleshooting

- **Build fails**: Check that Node.js version is set to 20.x
- **API not working**: Verify environment variables are set correctly
- **CORS issues**: Update the allowed origins in your server configuration

## 📚 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Salesforce Messaging Setup](https://help.salesforce.com/s/articleView?id=service.miaw_deployment_custom.htm&type=5)
- [Original Repository](https://github.com/SalesforceDiariesBySanket/sample-agentforce-custom-client)