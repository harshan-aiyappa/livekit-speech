# Real-Time Voice Transcription App

## Overview

This is a real-time voice transcription application that converts speech to text using LiveKit WebRTC technology. The app provides a single-page interface with live recording controls, audio visualization, session timing, and transcript display with export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **HTTP Server**: Express with custom middleware for logging and request handling
- **WebSocket**: Native ws library for real-time communication
- **Build**: esbuild for production bundling with selective dependency bundling

### Real-Time Communication
- **Technology**: LiveKit WebRTC for audio streaming and transcription
- **Token Generation**: Server-side JWT token generation using livekit-server-sdk
- **Client Integration**: livekit-client library for room connections and audio track management

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration
- **Current Storage**: In-memory storage (MemStorage class) for development
- **Database Ready**: PostgreSQL schema defined and ready for connection

### Key Design Patterns
- **Monorepo Structure**: Client, server, and shared code in single repository
- **Path Aliases**: `@/` for client source, `@shared/` for shared types
- **Type Safety**: Shared schema types between frontend and backend via Zod
- **Component Architecture**: Atomic design with reusable UI primitives

## External Dependencies

### Third-Party Services
- **LiveKit**: WebRTC-based real-time audio streaming and transcription
  - Requires `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` environment variables
  - LiveKit server URL for room connections

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema management

### Key NPM Packages
- **livekit-server-sdk**: Server-side token generation for LiveKit rooms
- **livekit-client**: Client-side WebRTC room management
- **drizzle-orm**: Type-safe SQL query builder
- **express**: HTTP server framework
- **ws**: WebSocket server implementation
- **@tanstack/react-query**: Async state management
- **@radix-ui/***: Headless UI component primitives
- **tailwindcss**: Utility-first CSS framework