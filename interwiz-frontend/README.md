# InterWiz Frontend

AI-powered interview screening platform frontend built with Next.js 14, TypeScript, and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed
- Backend server running on http://localhost:3001

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/              # Utilities and API client
├── stores/           # Zustand state management
├── types/            # TypeScript type definitions
└── hooks/            # Custom React hooks
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **Zustand** - State management
- **React Query** - Data fetching
- **Axios** - HTTP client
- **React Hook Form** - Form handling
- **Zod** - Schema validation

