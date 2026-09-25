# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- **Dev Server**: `pnpm dev`
- **Build**: `pnpm build`
- **Lint**: `pnpm lint`
- **Sanity Type Generation**: `pnpm typegen`

## Architecture & Code Structure
- **Framework & Stack**: Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4, Sanity CMS v6, Supabase.
- **Data Fetching**:
  - Sanity queries live in `src/sanity/queries/`.
  - Cached server fetches use wrappers in `src/sanity/serverCache.ts`.
- **Component Placement**:
  - Main view/page components: `src/components/[feature]/`
  - Reusable UI elements: `src/components/ui/`
  - Page-specific subcomponents co-located in subfolders near parent component.
- **Server/Client boundary**: Default to Server Components; explicitly declare `"use client"` only for client-side interactivity or browser API usage.
- **Authentication & API**: Custom API routes under `src/app/api/` handling face verification, device approvals, sessions, and database ops with Supabase.
