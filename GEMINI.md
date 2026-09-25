# SYSTEM INSTRUCTION & KNOWLEDGE GRAPH: TSG-Web-XZRAY

A modern, high-performance web application and content management system built for **The Smart Generation (TSG)** organization.

## 1. CORE ARCHITECTURE & STACK SPECIFICATION
- **Framework:** Next.js `16.3.2` (App Router, React Server Components default)
- **UI & Runtime:** React `19.2.8`, TypeScript `6.0.3` (Strict mode enforced)
- **CMS / Headless Data:** Sanity `6.10.1`, `next-sanity` `13.3.3`, `@sanity/image-url` `2.1.1`
- **Styling Pipeline:** Tailwind CSS `4.3.3` (`@tailwindcss/postcss`), Framer Motion `13.1.1`, Styled Components `6.5.3`
- **Icons & Utilities:** Lucide React `1.34.0`, React Icons `5.7.0`, UUID `14.0.2`, `clsx`, `tailwind-merge`
- **Package Manager:** pnpm (`pnpm-lock.yaml`, `pnpm-workspace.yaml`)

## 2. EXECUTION COMMANDS
- Dev server: `pnpm dev`

## 3. MANDATORY MACHINE DEVELOPMENT RULES
1. **Server/Client Boundary:** Default to Server Components. Inject `"use client"` strictly at leaf components requiring browser APIs, event listeners, or React hooks (`useState`, `useEffect`).
2. **Sanity GROQ & Caching:** Execute precise projections via GROQ in `src/sanity/queries/`. Utilize memoized wrappers (`src/sanity/serverCache.ts`) for data fetching to prevent duplicate network calls.
3. **Styling & Responsive Design:** Implement Tailwind CSS v4 utility classes with mobile-first breakpoints (`sm:`, `md:`, `lg:`). Avoid inline styles unless injecting runtime CSS custom properties.
4. **Strict Type Safety:** Never use `any` or `Record<string, any>` on React component props. Explicitly type all interfaces in `src/types/index.ts` or co-located prop declarations. Run `pnpm typegen` after modifying Sanity schemas.
5. **Hydration Integrity:** Prevent SSR/client markup mismatch by guarding browser-only objects (`window`, `localStorage`, non-deterministic dates) behind `useEffect` or client-mount flags.
6. **Error Boundaries & Fallbacks:** Provide explicit empty states and catch boundaries for all asynchronous data dependencies originating from Sanity CMS.
7. **Component Co-location:** Keep page-specific subcomponents inside local subdirectories alongside their parent component (`[Component]/[SubComponent].tsx`).
8. **Revalidation Strategy:** Explicitly set route revalidation policies (`export const revalidate = 0` or ISR intervals) on Next.js page components to balance real-time CMS sync and caching performance.
9. **Asset Optimization:** Use Next.js `<Image />` or Sanity Image Builder with explicit dimensions and format optimizations (WebP/AVIF).
10. **Clean Commit Standards:** Maintain strict adherence to Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) and eliminate unused imports/variables prior to build verification.

- Never use 'smart_write' or 'smart_edit', always use 'write' or 'edit' or similar Gemini CLI built-in tools. Only specifically for Write File or Edit File, for everything else, continue to prioritize using 'smart_*'
- NEVER BUILD, just implement it carefully and precisely
- Don't run the typecheck
