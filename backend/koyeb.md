# Deploy backend to Koyeb (Docker)

## 1) Push backend code to GitHub
Koyeb will build from `backend/Dockerfile`.

## 2) Create Web Service in Koyeb
- Deploy from GitHub repo
- Builder: Dockerfile
- Dockerfile path: `backend/Dockerfile`
- Exposed port: `8000` (or use `PORT` env)

## 3) Set environment variables in Koyeb
Required:
- `SECRET_KEY`
- `DATABASE_URL`
- `STORAGE_BACKEND=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=edu-kernel`
- `SUPABASE_STORAGE_PREFIX=uploads`
- `SUPABASE_STORAGE_PUBLIC=true`
- `SUPABASE_STORAGE_AUTO_CREATE_BUCKET=true`

## 4) DATABASE_URL for Supabase (recommended: pooler)
Use the `Transaction pooler` connection string from Supabase Dashboard:
- Supabase -> Project Settings -> Database -> Connection string -> Pooler

Format example:
`postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require`

## 5) First run DB bootstrap
You need to apply SQL once:
- `backend/supabase/01_schema.sql`
- `backend/supabase/02_data.sql`

Then backend works with Supabase only.
