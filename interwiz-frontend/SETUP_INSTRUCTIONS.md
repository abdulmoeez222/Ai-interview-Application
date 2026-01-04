# Frontend Setup Instructions

## Prerequisites

1. **Install Node.js** (if not already installed):
   - Download from: https://nodejs.org/
   - Install Node.js 18+ (LTS version recommended)
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

## Installation Steps

### 1. Install Dependencies

```bash
cd interwiz-frontend
npm install
```

### 2. Install Shadcn/ui Components

After dependencies are installed, run:

```bash
npx shadcn-ui@latest add button input label card form table dialog dropdown-menu select textarea badge separator avatar
```

### 3. Environment Variables

The `.env.local` file has been created. Verify it contains:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at: http://localhost:3000

## Project Structure

```
interwiz-frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth route group
│   │   ├── (dashboard)/       # Dashboard route group
│   │   ├── interview/         # Interview pages
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Homepage
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── auth/              # Auth components
│   │   ├── templates/         # Template components
│   │   ├── interviews/        # Interview components
│   │   ├── ui/                # Shadcn/ui components
│   │   └── shared/            # Shared components
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   ├── react-query-provider.tsx
│   │   └── utils.ts           # Utility functions
│   ├── stores/
│   │   └── auth-store.ts      # Auth state management
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   └── hooks/                 # Custom React hooks
├── .env.local                  # Environment variables
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Next Steps

1. ✅ Project structure created
2. ✅ TypeScript types defined
3. ✅ API client configured
4. ✅ Auth store setup
5. ✅ React Query provider ready
6. ⏭️ **Next:** Create authentication pages (Login/Register)

## Troubleshooting

### Issue: `npm` command not found
- Install Node.js from https://nodejs.org/
- Restart terminal after installation

### Issue: Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

### Issue: Module not found errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Verification Checklist

- [ ] Node.js installed (v18+)
- [ ] Dependencies installed (`npm install`)
- [ ] Shadcn/ui components installed
- [ ] `.env.local` file exists
- [ ] Backend server running on port 3001
- [ ] Frontend runs on http://localhost:3000
- [ ] No console errors
- [ ] Redirects to `/login` (404 expected - will create in next section)

