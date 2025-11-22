# MongoDB Atlas Setup Guide

This guide will walk you through setting up MongoDB Atlas for your Juego backend.

## Prerequisites

- A MongoDB Atlas account (sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas))
- Your backend code is already configured to use MongoDB (see `apps/backend/src/lib/mongodb.ts`)

## Step 1: Create a MongoDB Atlas Account

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** or **"Sign Up"**
3. Fill in your details and create an account
4. Verify your email if required

## Step 2: Create a New Cluster

1. Once logged in, you'll see the **"Deploy a cloud database"** screen
2. Choose **"M0 FREE"** (Free Shared Cluster) - perfect for development
3. Select your preferred **Cloud Provider** (AWS, Google Cloud, or Azure)
4. Choose a **Region** closest to your users or deployment location
5. Click **"Create"** (cluster name is optional, defaults to "Cluster0")

**Note:** Cluster creation takes 3-5 minutes. You'll see a progress indicator.

## Step 3: Create a Database User

1. While the cluster is being created, you'll be prompted to create a database user
2. Enter a **Username** (e.g., `juego-admin`)
3. Enter a **Password** (use a strong password - save it securely!)
4. Click **"Create Database User"**

**Important:** Save these credentials! You'll need them for the connection string.

## Step 4: Configure Network Access

1. In the **"Network Access"** section, you need to allow connections
2. Click **"Add IP Address"**
3. For development, click **"Add Current IP Address"** (adds your current IP)
4. For production/deployment, you have two options:
   - **Option A:** Add your deployment platform's IP ranges (e.g., Railway, Vercel)
   - **Option B:** Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`) - **Use with caution!**
5. Click **"Confirm"**

**Security Note:** For production, prefer specific IP ranges over allowing all IPs.

## Step 5: Get Your Connection String

1. Once your cluster is ready, click **"Connect"** button on your cluster
2. Choose **"Drivers"** connection method
3. Select **"Node.js"** as your driver
4. Copy the connection string - it will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<username>` with your database username
6. Replace `<password>` with your database password
7. Optionally, add your database name to the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/juego?retryWrites=true&w=majority
   ```

## Step 6: Configure Your Backend

1. Navigate to your backend directory:
   ```bash
   cd apps/backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file and add your connection string:
   ```env
   MONGODB_URI=mongodb+srv://juego-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/juego?retryWrites=true&w=majority
   MONGODB_DB_NAME=juego
   PORT=3001
   ```

**Important:** 
- Replace `YOUR_PASSWORD` with your actual database password
- Replace `cluster0.xxxxx.mongodb.net` with your actual cluster URL
- Make sure to URL-encode your password if it contains special characters (e.g., `@` becomes `%40`)

## Step 7: Test Your Connection

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Check the console - you should see:
   ```
   Connected to MongoDB
   Server is running on http://localhost:3001
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```

   You should get:
   ```json
   {"status":"ok","db":"connected"}
   ```

## Step 8: Deploy to Production (Railway/Other Platforms)

When deploying to Railway or other platforms:

1. Add the environment variables in your deployment platform:
   - `MONGODB_URI` - Your full connection string
   - `MONGODB_DB_NAME` - `juego` (or your preferred database name)

2. Make sure your deployment platform's IP is allowed in MongoDB Atlas Network Access

3. For Railway specifically:
   - Go to your Railway project settings
   - Add the environment variables under "Variables"
   - Railway IPs are typically already whitelisted, but check if you have connection issues

## Troubleshooting

### Connection Timeout
- **Issue:** Can't connect to MongoDB Atlas
- **Solution:** 
  - Check Network Access settings in Atlas
  - Ensure your IP address is whitelisted
  - For production, ensure your deployment platform's IPs are whitelisted

### Authentication Failed
- **Issue:** Authentication error when connecting
- **Solution:**
  - Verify username and password are correct
  - URL-encode special characters in password
  - Check that the database user exists and is active

### Database Not Found
- **Issue:** Database doesn't exist
- **Solution:**
  - MongoDB Atlas creates databases automatically on first write
  - Your code will create the collections automatically when you first use them
  - No need to manually create the database

### Connection String Format
- **Issue:** Connection string not working
- **Solution:**
  - Ensure the connection string starts with `mongodb+srv://`
  - Include the database name in the path: `...mongodb.net/juego?...`
  - Or set `MONGODB_DB_NAME` environment variable separately

## Collections Created Automatically

Your application will automatically create these collections when first used:
- `gameWorlds` - Stores game world configurations
- `players` - Stores player data and positions
- `worldObjects` - Stores world objects and obstacles

No manual collection creation needed!

## Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use strong passwords** for database users
3. **Limit IP access** - Only allow necessary IPs in Network Access
4. **Use separate users** for development and production if possible
5. **Rotate passwords** periodically
6. **Enable MongoDB Atlas monitoring** to track usage and potential issues

## Next Steps

Once your connection is working:
- Your game data will be stored in MongoDB Atlas
- Collections will be created automatically on first use
- You can view your data in the MongoDB Atlas web interface under "Browse Collections"

## Useful Links

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver Documentation](https://docs.mongodb.com/drivers/node/)
- [Connection String URI Format](https://docs.mongodb.com/manual/reference/connection-string/)

