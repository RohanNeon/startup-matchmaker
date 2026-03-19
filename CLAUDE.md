@AGENTS.md

# Neon Fund — Startup Matchmaker

## What this is
AI-powered matchmaking for startup networking events (~100 attendees). Attendees fill a verified profile form → at a set time, each attendee receives an email with their top 5-6 best matches including LinkedIn profiles and one-line reasoning.

## Architecture pivot (v2)
- **v1 (built, kept for future):** Chat interface with Groq LLM for live matchmaking Q&A
- **v2 (current):** Email-based match delivery. No chat. Form → wait → receive matches via email at noon.

## Tech stack
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Database**: Supabase (Postgres + REST API + Auth + RLS)
- **Auth**: Supabase email OTP
- **Email SMTP**: Brevo (free tier, 300 emails/day) — connected to Supabase custom SMTP
- **Email delivery (match emails)**: TBD (Brevo transactional API or Supabase)
- **Match algorithm**: TBD
- **Font**: Inter (Google Fonts)
- **Deploy**: Vercel (startup-matchmaker-kappa.vercel.app)
- **Future LLM**: Groq API (llama-3.3-70b-versatile) via OpenAI-compatible SDK

## Branding — Neon Fund color palette (LIGHT theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neon` | #e8ff79 | Primary accent, active buttons, highlights |
| `--color-neon-dark` | #1d3d0f | Text, dark buttons, borders |
| `--color-neon-bg` | #fdfff0 | Page background, card surfaces |
| `--color-neon-hover` | #d4eb65 | Hover states |
| White | #ffffff | Card backgrounds |

Logo: `public/neon-logo.png` (also `.svg`). Lime-green "N" mark on transparent bg.

## Database schema (Supabase)

### `luma_list` table
- email (text, PK) — email used for Luma registration
- linkedin_url (text) — LinkedIn profile URL
- **100 attendees uploaded** from luma_list.csv (source file in project root)

### `profiles` table
- email (text, PK) — links to luma_list.email
- name, company, role (text, NOT NULL)
- what_building (text, nullable/optional)
- looking_for, can_offer (text[])
- created_at (timestamptz)
- **Removed:** stage, walk_away_with (dropped from schema)

## Core data flow (v2)
1. Organizer uploads Luma CSV (email + LinkedIn) → stored in `luma_list`
2. Attendees get link via Luma email or QR code at event door
3. Enter email → real-time validation against `luma_list`
   - Not found → "Please enter the email you used for Luma registration"
   - Found → proceed to form
4. Fill form fields → click submit → Supabase sends email OTP
5. Verify OTP → profile saved to `profiles` table
6. See waiting screen: "We'll send your best matches to your email!"
7. At 12 noon → admin triggers match calculation + email send
8. Each attendee gets email with top 5-6 matches (name, LinkedIn, one-line reason)

## Event timeline
- **Before event:** Upload Luma list, share form link
- **11:00 AM:** Event starts, attendees fill form via link/QR
- **11:30 AM:** Entry closes
- **12:00 PM:** Match emails sent (admin triggered)
- **12:00+:** Networking session — attendees know who to find

## Two-step auth
1. **Email validation (pre-submit):** On email input blur, check against `luma_list` in real-time. If not found, show inline error. Prevents non-attendees from registering.
2. **Email OTP (on submit):** Supabase Auth sends OTP to the email. User verifies before profile is saved. Confirms the person filling the form owns that email.

## File structure
```
src/
├── app/
│   ├── page.tsx                    # Root — routes to form or waiting screen
│   ├── layout.tsx                  # Root layout, Inter font, metadata
│   ├── globals.css                 # Tailwind + Neon theme tokens
│   ├── api/chat/route.ts           # POST /api/chat — Groq LLM (future use)
│   ├── api/validate-email/route.ts # POST — checks email against luma_list
│   ├── api/send-matches/route.ts   # POST — triggers match calc + email send
├── components/
│   ├── OnboardingForm.tsx          # Profile form with email validation + OTP
│   ├── WaitingScreen.tsx           # Post-submission waiting screen
│   └── ChatInterface.tsx           # Chat UI (kept for future)
├── lib/
│   ├── supabase.ts                 # Supabase client init
│   └── types.ts                    # TypeScript interfaces
```

## Onboarding form fields
- Email (text, validated against luma_list on blur, checked for existing profile before OTP)
- Full name, Company, Role (text inputs, required)
- What are you building? (textarea, optional, 100-word limit)
- Looking for: Investor / Co-founder / Customers / Talent / Peers (multi-select chips, required)
- Can offer: same options (multi-select chips, required)
- **Removed:** Stage, Walk away with

## Match email format
```
Dear {name},

Thanks for coming to the event! Based on your profile, here are the people we think you should meet:

1. {Name} — {LinkedIn URL}
   {One-line reason}
2. {Name} — {LinkedIn URL}
   {One-line reason}
... (up to 5-6)
```

## Design principles
- Light theme, NOT dark
- Mobile-first responsive (works on phone at event)
- Clean, minimal — professional startup event feel
- Rounded corners (2xl cards, xl inputs), subtle borders, minimal shadows
- Neon lime accent on cream background

## Environment variables (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — for admin operations (server-side only, NOT yet in .env.local)
- `GROQ_API_KEY` — Groq API key (server-side only, future use)

## Supabase credentials
- Project URL: https://iuxpiutfhskitcaesyjk.supabase.co
- Service role key: needed for admin operations (user has it, not stored in .env.local yet)

## Brevo SMTP (email delivery)
- Provider: Brevo (formerly Sendinblue), free tier — 300 emails/day
- SMTP: smtp-relay.brevo.com, port 587
- Username: a56b31001@smtp-brevo.com
- Connected to Supabase custom SMTP settings
- Sender: Neon Fund <rohan@neon.fund>
- **DNS auth (pending):** SPF TXT + 2 DKIM CNAME records need to be added in GoDaddy for neon.fund domain to remove Gmail spam warning
- Domain: neon.fund hosted on GoDaddy

## Deployment
- **Vercel:** startup-matchmaker-kappa.vercel.app
- **GitHub:** RohanNeon/startup-matchmaker
- Auto-deploys on every push to main

## Current state
- [x] Onboarding form with all fields + validation
- [x] Neon Fund branding (colors, logo, Inter font)
- [x] Mobile-responsive design
- [x] Deployed to Vercel (auto-deploy on push to main)
- [x] GitHub repo connected (RohanNeon/startup-matchmaker)
- [x] Chat interface with Groq LLM (built, kept for future)
- [x] Email field + real-time Luma list validation (on blur)
- [x] Supabase email OTP auth (8-digit code)
- [x] Brevo SMTP connected (300 emails/day free, replaces Supabase built-in)
- [x] Branded OTP email template (Neon Fund logo, lime-green code box)
- [x] luma_list table created with 100 attendees uploaded
- [x] Waiting screen after form submission
- [x] Duplicate profile check before sending OTP (saves email tokens)
- [x] Upsert on profile save (handles edge cases)
- [x] Removed stage + walk_away_with fields, what_building now optional (100-word limit)
- [x] PRD in PROJECT.md
- [ ] DNS records for Brevo (SPF + DKIM in GoDaddy) — fixes Gmail spam warning
- [ ] Update Magic Link email template in Supabase (currently sends link instead of code)
- [ ] Match algorithm (TBD)
- [ ] Email delivery system for match emails
- [ ] Admin trigger for sending matches
- [ ] Test cases for concurrency (100 users, documented but not implemented)

## Key decisions
1. **v2 pivot:** Replaced live chat with email-based match delivery — better for event format (everyone gets matches at same time)
2. **Two-step auth:** Email validation against Luma list + email OTP — ensures only real attendees register and own the email
3. **Email as PK:** Email links profiles to luma_list (for LinkedIn URLs) — simpler than UUID + join
4. **Groq chat kept:** Built and working, saved for future use (post-match follow-up or next event version)
5. **Match algorithm TBD:** Core logic not yet decided — will determine based on profile field weights
6. **No form close:** Form stays open, no hard cutoff in UI
7. **Brevo over Supabase built-in email:** Supabase free tier has ~30 emails/hour cap, Brevo gives 300/day — needed for 100 attendees
8. **Duplicate check before OTP:** Check profiles table before sending OTP to avoid wasting email tokens
9. **Upsert over insert:** Profile save uses upsert to handle edge cases gracefully
10. **Supabase auth.users vs profiles:** auth.users entries are created on OTP send (normal Supabase behavior), profiles only after verification — this is expected

## Pending tasks (next session)
1. **DNS records in GoDaddy** — Add SPF TXT + 2 DKIM CNAME records for neon.fund to remove Gmail spam warning
2. **Fix Magic Link template** — Update ALL Supabase email templates (especially Magic Link) with branded OTP HTML using {{ .Token }}
3. **Test full flow end-to-end** — After DNS + template fixes, test complete: form → OTP → verify → waiting screen
4. **Match algorithm** — Design and implement matching logic
5. **Match email delivery** — Build admin trigger + email send via Brevo API
6. **Concurrency test cases** — Implement fixes for OTP rate limiting, duplicate submissions, etc.
7. **Update PRD** — Add test cases and current architecture to PROJECT.md
