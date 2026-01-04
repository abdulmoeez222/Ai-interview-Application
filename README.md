# InterWiz MVP - AI Interview Screening Platform

A complete AI-powered interview screening platform built with NestJS, Next.js, Prisma, PostgreSQL, and OpenAI GPT-4.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone Repository
```bash
git clone https://github.com/abdulmoeez222/Ai-interview-Application.git
cd Ai-interview-Application
```

### 2. Start PostgreSQL Database
```bash
docker-compose up -d
```

This will start PostgreSQL on port 5432 with:
- Username: `postgres`
- Password: `postgres123`
- Database: `interwiz_mvp`

### 3. Backend Setup

```bash
cd interwiz-backend

# Install dependencies
npm install
npm install @nestjs/serve-static

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env and add your API keys:
# - OPENAI_API_KEY
# - ASSEMBLYAI_API_KEY
# - ELEVENLABS_API_KEY

# Setup database
npm run prisma:generate
npm run prisma:migrate

# Create upload directories
mkdir -p uploads/questions uploads/responses

# Start backend
npm run start:dev
```

Backend runs on: http://localhost:3001

### 4. Frontend Setup

```bash
cd interwiz-frontend

# Install dependencies
npm install

# Install Shadcn components
npx shadcn-ui@latest add progress

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local

# Start frontend
npm run dev
```

Frontend runs on: http://localhost:3000

## 📋 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/interwiz_mvp?schema=public"
JWT_SECRET="your-secret-key-min-32-chars"
OPENAI_API_KEY="sk-..."
ASSEMBLYAI_API_KEY="your-key"
ELEVENLABS_API_KEY="your-key"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 🗄️ Database

The database is managed by Docker. To access:

```bash
# View database
docker exec -it interwiz-postgres psql -U postgres -d interwiz_mvp

# Or use Prisma Studio
cd interwiz-backend
npm run prisma:studio
```

## 🛠️ Development

### Backend Commands
```bash
npm run start:dev    # Development server
npm run build        # Build for production
npm run prisma:studio # Open database GUI
```

### Frontend Commands
```bash
npm run dev          # Development server
npm run build        # Build for production
npm run start        # Production server
```

## 📁 Project Structure

```
├── interwiz-backend/     # NestJS Backend API
├── interwiz-frontend/    # Next.js Frontend
├── docker-compose.yml    # PostgreSQL Docker setup
└── README.md
```

## 🔑 API Keys Required

1. **OpenAI** - https://platform.openai.com/api-keys
2. **AssemblyAI** - https://www.assemblyai.com/
3. **ElevenLabs** - https://elevenlabs.io/

## 📝 Features

- ✅ User Authentication (JWT)
- ✅ Interview Templates Management
- ✅ Assessments & Questions
- ✅ AI-Powered Interviews (GPT-4)
- ✅ Voice Integration (STT/TTS)
- ✅ Real-time WebSocket Support
- ✅ Interview Scheduling
- ✅ Automated Scoring & Evaluation

## 🐛 Troubleshooting

### Docker Issues
```bash
# Restart Docker Desktop
# Then run:
docker-compose down
docker-compose up -d
```

### Database Connection
```bash
# Check if PostgreSQL is running
docker ps

# Check logs
docker logs interwiz-postgres
```

## 📄 License

Private - All Rights Reserved

