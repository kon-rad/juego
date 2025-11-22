# Railway Deployment Guide

## Prerequisites
- GitHub repository: `kon-rad/juego` ✅
- Neon database connection string ✅
- Railway account (free tier)

## Step 1: Update Frontend API URL

The frontend needs to use an environment variable for the backend URL instead of hardcoded `localhost:3001`.

**File to update**: `apps/frontend/src/components/GameCanvas.tsx`

Replace all instances of:
```typescript
'http://localhost:3001/api/...'
```

With:
```typescript
`${process.env.NEXT_PUBLIC_API_URL}/api/...`
```

## Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose repository: `kon-rad/juego`
5. Railway will detect multiple services - select **backend** first
6. Configure backend service:
   - **Root Directory**: `apps/backend`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm run dev`

7. Add environment variables:
   - `DATABASE_URL` = <YOUR_DATABASE_URL>
   - `PORT` = `${{RAILWAY_PROVIDED_PORT}}`

8. Click **"Deploy"**
9. Copy the backend URL (e.g., `https://juego-backend-production.up.railway.app`)

## Step 3: Deploy Frontend to Railway

1. In the same Railway project, click **"New Service"**
2. Select **"Deploy from GitHub repo"** again
3. Choose the same repository: `kon-rad/juego`
4. Select **frontend** service
5. Configure frontend service:
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`

6. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `<your-backend-url-from-step-2>`
   - Example: `https://juego-backend-production.up.railway.app`

7. Click **"Deploy"**

## Step 4: Enable Auto-Deploy

Railway automatically deploys on every push to main branch once connected to GitHub! ✅

## Step 5: Test Deployment

1. Visit your frontend Railway URL
2. Open browser console
3. Try moving with WASD keys
4. Check that player position syncs to database
5. Open in another browser/incognito to test multiplayer

## Environment Variables Summary

### Backend (Railway)
```
DATABASE_URL=<YOUR_DATABASE_URL>
PORT=${{RAILWAY_PROVIDED_PORT}}
```

### Frontend (Railway)
```
NEXT_PUBLIC_API_URL=https://your-backend-url.up.railway.app
```

## Troubleshooting

### Backend won't start
- Check that Prisma generates successfully: `npx prisma generate`
- Verify DATABASE_URL is correct
- Check Railway logs for errors

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is deployed and running

### Database connection errors
- Neon database may be suspended - first request wakes it up
- Verify connection string is correct
- Check Neon dashboard for database status

## Next Steps

After deployment:
1. Update `README.md` with live URLs
2. Test multiplayer with friends
3. Monitor Railway logs for errors
4. Set up custom domain (optional)
