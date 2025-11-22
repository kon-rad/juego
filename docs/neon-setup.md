# Neon PostgreSQL Setup Instructions

## Step 1: Authenticate with Neon

Run this command to login to Neon (it will open a browser):

```bash
neonctl auth
```

## Step 2: Create a Neon Project

After authentication, create a new project:

```bash
neonctl projects create --name juego
```

## Step 3: Get Connection String

Get your database connection string:

```bash
neonctl connection-string juego
```

## Step 4: Update .env File

Copy the connection string from Step 3 and update your `.env` file in `apps/backend/.env`:

```
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

## Next Steps

Once you've completed these steps and updated the `.env` file, let me know and I'll:
1. Update the Prisma schema with game state models
2. Run the migrations
3. Create the API endpoints
4. Update the frontend

---

**Note**: The Neon CLI has been installed globally. You can run these commands from any directory.
