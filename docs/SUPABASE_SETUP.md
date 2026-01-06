# Supabase Setup Guide

This guide will help you set up Supabase for the nextjs-coding-tool project.

## Prerequisites

- A Supabase account ([sign up here](https://supabase.com))
- A GitHub account (for OAuth authentication)

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in the project details:
   - **Name**: Choose a name (e.g., "nextjs-coding-tool")
   - **Database Password**: Generate a strong password (save this for later)
   - **Region**: Choose the region closest to your users
4. Click "Create new project" and wait for it to provision

## Step 2: Run Database Migrations

1. Once your project is ready, navigate to the **SQL Editor** in the left sidebar
2. Click "New query"
3. Copy and paste the entire contents of `supabase/migrations/20260106_init_schema.sql`
4. Click "Run" to execute the migration
5. You should see a success message confirming all tables, indexes, and policies were created

## Step 3: Configure GitHub OAuth

1. In your Supabase dashboard, navigate to **Authentication** → **Providers**
2. Find **GitHub** in the list and enable it
3. You'll need to create a GitHub OAuth App:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Fill in the details:
     - **Application name**: nextjs-coding-tool (or your preferred name)
     - **Homepage URL**: `http://localhost:3000` (for local dev) or your production URL
     - **Authorization callback URL**: Copy from Supabase (it will look like `https://[your-project-ref].supabase.co/auth/v1/callback`)
   - Click "Register application"
4. Copy the **Client ID** and generate a **Client Secret**
5. Paste these values back into Supabase in the GitHub provider settings
6. Click "Save"

## Step 4: Configure Site URL and Redirect URLs

1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set the **Site URL** to:
   - For local dev: `http://localhost:3000`
   - For production: Your deployed URL (e.g., `https://your-app.vercel.app`)
3. Add **Redirect URLs** (comma-separated):
   - `http://localhost:3000/**` (for local dev)
   - `https://your-app.vercel.app/**` (for production)

## Step 5: Get Your API Keys

1. In Supabase, navigate to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key**: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 6: Configure Environment Variables

1. In your project root, create a `.env.local` file (copy from `.env.example`):

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration (required for project persistence)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Replace the placeholder values with your actual keys

## Step 7: Test the Integration

1. Start your development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000)
3. Click the "📁 Projects" button
4. Click "Sign In with GitHub"
5. Authorize the application
6. You should be redirected back and see the project management interface

## Vercel Deployment

When deploying to Vercel:

1. Add the environment variables in your Vercel project settings:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Update your Supabase Site URL and Redirect URLs to include your Vercel deployment URL

3. Optionally, you can use the [Vercel Supabase Integration](https://vercel.com/integrations/supabase) for easier setup

## Troubleshooting

### "Invalid login credentials" error
- Ensure GitHub OAuth is properly configured in Supabase
- Check that the callback URL in GitHub matches the one in Supabase

### "Your project's URL and API key are required" error
- Verify your `.env.local` file has the correct Supabase credentials
- Restart your dev server after adding environment variables

### Database connection errors
- Check that the migration was successfully run
- Verify RLS (Row Level Security) policies are enabled

### Users can't see their projects
- Ensure the user is properly authenticated
- Check browser console for any errors
- Verify RLS policies are correctly configured

## Database Schema Overview

The migration creates the following tables:

- **projects**: Stores project metadata (name, owner, timestamps)
- **project_files**: Stores file contents (path, content, timestamps)
- **project_changesets**: Tracks change history for debugging
- **cli_tokens**: API tokens for CLI authentication (future feature)

All tables have Row Level Security (RLS) enabled to ensure users can only access their own data.

## Security Considerations

- Never commit `.env.local` to version control
- Use the anon key (not the service role key) in your frontend
- RLS policies protect all data at the database level
- GitHub OAuth provides secure authentication
- API routes verify authentication before any database operations

## Next Steps

- Test creating and loading projects
- Test the "Apply changes" workflow
- Explore the API routes documentation in the README
- Consider implementing additional features like project sharing or templates
