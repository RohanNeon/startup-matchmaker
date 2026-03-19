@AGENTS.md

# Neon Fund — Startup Matchmaker

## What this is
AI-powered matchmaking web app for startup networking events (~50 attendees). Users fill a profile → chat with an LLM that knows everyone at the event → get told exactly who to meet and why.

## Tech stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Database**: Supabase (Postgres + REST API + RLS)
- **LLM**: Groq API (llama-3.3-70b-versatile) via OpenAI-compatible SDK (`openai` npm package)
- **Font**: Inter (Google Fonts)
- **Deploy target**: Vercel

## Branding — Neon Fund color palette (LIGHT theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neon` | #e8ff79 | Primary accent, active buttons, highlights |
| `--color-neon-dark` | #1d3d0f | Text, dark buttons, borders |
| `--color-neon-bg` | #fdfff0 | Page background, card surfaces |
| `--color-neon-hover` | #d4eb65 | Hover states |
| White | #ffffff | Card backgrounds, assistant chat bubbles |

Logo: `public/neon-logo.png` (also `.svg`). Lime-green "N" mark on transparent bg.

## Database schema (Supabase)
```
profiles: id (uuid PK), name, company, role, what_building, stage, looking_for (text[]), can_offer (text[]), walk_away_with, created_at
```
- RLS enabled: public read + insert (no auth yet)
- 9 demo profiles seeded for testing

## File structure
```
src/
├── app/
│   ├── page.tsx              # Root — checks localStorage, routes to form or chat
│   ├── layout.tsx            # Root layout, Inter font, metadata
│   ├── globals.css           # Tailwind + Neon theme tokens
│   ├── api/chat/route.ts     # POST /api/chat — builds system prompt, calls Groq
├── components/
│   ├── OnboardingForm.tsx    # Profile creation (all fields, multi-select chips)
│   └── ChatInterface.tsx     # Chat UI, auto-greeting, streaming-style display
├── lib/
│   ├── supabase.ts           # Supabase client init
│   └── types.ts              # Profile + ChatMessage interfaces
```

## Core data flow
1. User lands → check localStorage for `profile_id`
2. No profile → OnboardingForm → insert to Supabase → save id to localStorage
3. Has profile → ChatInterface → auto-greeting (empty message triggers welcome)
4. User asks question → POST /api/chat with `{ profileId, messages }`
5. API fetches current user + ALL other profiles from Supabase
6. Builds system prompt with all attendee data embedded
7. Calls Groq LLM → returns response → displayed in chat

## API endpoint: POST /api/chat
- Input: `{ profileId: string, messages: ChatMessage[] }`
- Fetches user profile + all other profiles from Supabase
- System prompt tells LLM: you are a matchmaking assistant, here is the user, here are all attendees, suggest specific people by name with reasoning
- Model: llama-3.3-70b-versatile, temp: 0.7, max_tokens: 1024

## Onboarding form fields
- Full name, Company, Role (text inputs)
- What are you building? (text)
- Stage: Idea / Pre-revenue / Revenue / Scaling (single-select chips)
- Looking for: Investor / Co-founder / Customers / Talent / Peers (multi-select chips)
- Can offer: same options (multi-select chips)
- One thing you want to walk away with today (text)

## Design principles
- Light theme, NOT dark
- Mobile-first responsive (works on phone at event)
- Clean, minimal — professional startup event feel
- Rounded corners (2xl cards, xl inputs), subtle borders, minimal shadows
- Neon lime accent on cream background

## Environment variables (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `GROQ_API_KEY` — Groq API key (server-side only)

## Chat suggestion chips
After the LLM greeting, 5 pre-made chips appear for quick-start:
- "Who should I meet?"
- "Any investors here?"
- "Who's building something similar to me?"
- "Find my top 3 matches"
- "Who can help me with funding?"
Chips disappear after the user sends any message (chip click or typed).

## Supabase credentials
- Project URL: https://iuxpiutfhskitcaesyjk.supabase.co
- Service role key is available for admin operations

## Current state (v1 complete)
- [x] Onboarding form with all fields + validation
- [x] Chat interface with LLM matchmaking + auto-greeting
- [x] 5 pre-made suggestion chips in chat
- [x] 9 demo profiles seeded in Supabase
- [x] Neon Fund branding (colors, logo, Inter font)
- [x] Mobile-responsive design
- [x] PRD documented in PROJECT.docx

## What's next (v2)
- [ ] Add Supabase Auth — Phone OTP (Twilio SMS) for real identity
- [ ] Tie profiles to auth.users, tighten RLS
- [ ] Deploy to Vercel
- [ ] LinkedIn URLs on profiles (profile photos + connect links)
- [ ] Admin dashboard
- [ ] Conversation history persistence
- [ ] Multi-event support

## Key decisions made
1. No auth in v1 — localStorage for profile persistence (fast onboarding, no friction). Phone OTP planned for v2.
2. All profiles loaded into LLM context — works for ~50 attendees, won't scale to 500+
3. Groq over OpenAI — faster + cheaper for real-time chat at events
4. Permissive RLS — will tighten when auth is added
5. Single-page app feel — form and chat on same route, client-side routing
6. Suggestion chips for UX — guests know what to ask without guessing
