# Neon Fund — Startup Matchmaker

## What it does
AI-powered matchmaking assistant for startup networking events (~50 attendees). Attendees fill a profile, then chat with an LLM that knows everyone at the event and suggests who to meet.

## Core flow
1. User lands on app → fills onboarding form (name, company, role, what they're building, stage, looking for, can offer, goal)
2. Profile saved to Supabase
3. Chat opens → LLM greets user by name, ready to answer "who should I meet?", "any investors here?", etc.
4. If profile already exists (localStorage check), skips straight to chat

## Tech stack
- **Frontend**: Next.js 16 (App Router), Tailwind CSS, TypeScript
- **Database**: Supabase (Postgres + REST API)
- **LLM**: Groq API (llama-3.3-70b-versatile) via OpenAI-compatible SDK
- **Deploy target**: Vercel

## Database schema
- **profiles** table: id (uuid), name, company, role, what_building, stage, looking_for (text[]), can_offer (text[]), walk_away_with, created_at
- RLS enabled: public read + insert (no auth yet)

## Key files
- `src/app/page.tsx` — routing logic (form vs chat based on localStorage)
- `src/components/OnboardingForm.tsx` — profile creation form
- `src/components/ChatInterface.tsx` — chat UI with auto-greeting
- `src/app/api/chat/route.ts` — builds system prompt with all profiles, calls Groq
- `src/lib/supabase.ts` — Supabase client
- `src/lib/types.ts` — TypeScript interfaces
- `supabase-schema.sql` — database migration
- `.env.local` — SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY

## Current state
- [x] Onboarding form with all fields
- [x] Chat interface with LLM matchmaking
- [x] 9 demo profiles seeded in Supabase
- [x] Neon Fund branding (color palette + logo)
- [x] Mobile-responsive design
- [ ] Authentication (next step)
- [ ] Deploy to Vercel

## What's next
1. **Add auth** — Supabase Auth (magic link or Google OAuth) so each user has a real identity, profiles are tied to auth.users, and RLS policies can be tightened
2. **Deploy to Vercel** — connect repo, set env vars, ship it
3. **Optional enhancements** — admin dashboard to see all profiles, conversation history persistence, event-specific scoping if reused across events
