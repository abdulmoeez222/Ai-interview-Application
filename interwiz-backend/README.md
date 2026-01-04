# InterWiz Backend

AI Interview Screening Platform - Backend API

## Setup Instructions

### 1. Install Dependencies

```bash
cd interwiz-backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/interwiz_mvp?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRATION="7d"

# OpenAI
OPENAI_API_KEY="your-openai-api-key-here"

# App
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

### 3. Database Setup

Make sure PostgreSQL is running, then:

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and run initial migration
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Run the Application

```bash
# Development mode
npm run start:dev
```

The application will be available at `http://localhost:3001/api`

## Project Structure

```
interwiz-backend/
├── src/
│   ├── prisma/          # Prisma service and module
│   ├── app.module.ts    # Main application module
│   └── main.ts          # Application entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## Available Scripts

- `npm run start:dev` - Start development server
- `npm run build` - Build for production
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

