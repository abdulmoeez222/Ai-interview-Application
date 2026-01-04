# 🚀 Complete Setup Instructions - InterWiz MVP

## ✅ What's Already Done

1. ✅ **Git Repository** - All code pushed to GitHub
2. ✅ **Docker Configuration** - PostgreSQL setup ready
3. ✅ **Environment Files** - Created with default values
4. ✅ **Project Structure** - Complete backend and frontend

---

## 📋 Step-by-Step Setup

### STEP 1: Start PostgreSQL Database

**Make sure Docker Desktop is running first!**

```powershell
# Navigate to project root
cd "C:\Users\abdmo\OneDrive\Desktop\Ai Interviewer App"

# Start PostgreSQL container
docker-compose up -d

# Wait 10 seconds for database to initialize
Start-Sleep -Seconds 10

# Verify it's running
docker ps
```

You should see `interwiz-postgres` container running.

**Database Details:**
- Host: `localhost`
- Port: `5432`
- Database: `interwiz_mvp`
- Username: `postgres`
- Password: `postgres123`

---

### STEP 2: Get API Keys

You need 3 API keys:

#### 2.1 OpenAI API Key
1. Go to: https://platform.openai.com/
2. Sign up/Login
3. Go to: https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)

#### 2.2 AssemblyAI API Key
1. Go to: https://www.assemblyai.com/
2. Sign up (free tier available)
3. Go to Dashboard → API Keys
4. Copy your API key

#### 2.3 ElevenLabs API Key
1. Go to: https://elevenlabs.io/
2. Sign up (free tier available)
3. Go to Profile → API Keys
4. Create new API key
5. Copy the key

---

### STEP 3: Configure Backend

#### 3.1 Edit Environment File

Open `interwiz-backend/.env` and replace these lines:

```env
# Replace with your actual keys:
OPENAI_API_KEY="sk-your-actual-openai-key-here"
ASSEMBLYAI_API_KEY="your-actual-assemblyai-key-here"
ELEVENLABS_API_KEY="your-actual-elevenlabs-key-here"
```

**Important:** The `DATABASE_URL` is already set correctly for Docker:
```env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/interwiz_mvp?schema=public"
```

#### 3.2 Install Backend Dependencies

```powershell
cd interwiz-backend

# Install all dependencies
npm install

# Install additional package for file serving
npm install @nestjs/serve-static
```

#### 3.3 Setup Database

```powershell
# Generate Prisma Client
npm run prisma:generate

# Run database migrations (creates all tables)
npm run prisma:migrate
```

When prompted for migration name, type: `init`

#### 3.4 Create Upload Directories

```powershell
# Create directories for audio files
New-Item -ItemType Directory -Force -Path "uploads\questions"
New-Item -ItemType Directory -Force -Path "uploads\responses"
```

---

### STEP 4: Configure Frontend

#### 4.1 Install Frontend Dependencies

```powershell
cd interwiz-frontend

# Install all dependencies
npm install

# Install Shadcn Progress component
npx shadcn-ui@latest add progress
```

#### 4.2 Verify Environment File

Check that `interwiz-frontend/.env.local` exists with:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

### STEP 5: Start the Application

#### 5.1 Start Backend (Terminal 1)

```powershell
cd interwiz-backend
npm run start:dev
```

Wait for: `Nest application successfully started`

Backend will run on: **http://localhost:3001**

#### 5.2 Start Frontend (Terminal 2)

```powershell
cd interwiz-frontend
npm run dev
```

Wait for: `Ready on http://localhost:3000`

Frontend will run on: **http://localhost:3000**

---

### STEP 6: Test the Application

1. **Open Browser:** http://localhost:3000
2. **Register Account:**
   - Click "Sign up"
   - Fill in your details
   - Create account
3. **Create Template:**
   - Go to Templates
   - Click "New Template"
   - Fill in details and save
4. **Create Interview:**
   - Go to Interviews
   - Click "New Interview"
   - Fill in candidate details
   - Copy the interview link
5. **Test Interview:**
   - Open link in new browser/incognito
   - Start interview
   - Test audio recording

---

## 🔍 Verification Checklist

### Database
- [ ] Docker container running (`docker ps`)
- [ ] Can connect to database
- [ ] Migrations completed successfully

### Backend
- [ ] Dependencies installed
- [ ] `.env` file has all API keys
- [ ] `npm run prisma:generate` completed
- [ ] `npm run prisma:migrate` completed
- [ ] Server starts without errors
- [ ] Accessible at http://localhost:3001

### Frontend
- [ ] Dependencies installed
- [ ] Shadcn Progress component installed
- [ ] `.env.local` file exists
- [ ] Server starts without errors
- [ ] Accessible at http://localhost:3000

---

## 🐛 Common Issues & Solutions

### Issue 1: Docker Not Starting
**Error:** `Docker Desktop is unable to start`

**Solution:**
1. Make sure Docker Desktop is installed
2. Start Docker Desktop manually
3. Wait for it to fully start
4. Try again: `docker-compose up -d`

### Issue 2: Database Connection Failed
**Error:** `Can't reach database server`

**Solution:**
```powershell
# Check if container is running
docker ps

# Check container logs
docker logs interwiz-postgres

# Restart container
docker-compose restart
```

### Issue 3: API Key Errors
**Error:** `API key not configured`

**Solution:**
1. Check `interwiz-backend/.env` file exists
2. Verify all 3 API keys are added
3. Make sure there are no extra spaces
4. Restart backend after adding keys

### Issue 4: Port Already in Use
**Error:** `Port 3001 is already in use`

**Solution:**
1. Change port in `interwiz-backend/.env`:
   ```env
   PORT=3002
   ```
2. Update `interwiz-frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3002/api
   ```

### Issue 5: Prisma Migration Fails
**Error:** `Migration failed`

**Solution:**
```powershell
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Or create new migration
npm run prisma:migrate dev --name init
```

---

## 📁 Important Files

### Backend
- `interwiz-backend/.env` - **ADD YOUR API KEYS HERE**
- `interwiz-backend/prisma/schema.prisma` - Database schema
- `interwiz-backend/uploads/` - Audio file storage

### Frontend
- `interwiz-frontend/.env.local` - API URL configuration
- `interwiz-frontend/src/` - Source code

### Root
- `docker-compose.yml` - PostgreSQL Docker setup
- `README.md` - Project documentation

---

## 🎯 Quick Commands Reference

### Database
```powershell
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View database logs
docker logs interwiz-postgres

# Access database
docker exec -it interwiz-postgres psql -U postgres -d interwiz_mvp
```

### Backend
```powershell
cd interwiz-backend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run start:dev

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Frontend
```powershell
cd interwiz-frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📞 Next Steps After Setup

1. ✅ Add your API keys to `interwiz-backend/.env`
2. ✅ Run database migrations
3. ✅ Start both servers
4. ✅ Test the application
5. ✅ Create your first interview!

---

## 🎉 You're All Set!

Once you complete these steps, your InterWiz MVP will be fully functional!

**Repository:** https://github.com/abdulmoeez222/Ai-interview-Application

**Need Help?** Check the main `README.md` or `SETUP_COMPLETE.md`

