# Neon Fund — Startup Matchmaker PRD

## Name
Startup Matchmaker by Neon Fund

## Overview
AI-powered matchmaking for in-person startup networking events (~50 attendees). Attendees fill a profile form → verified via email → at a set time, each attendee receives an email with their top 5-6 best matches including LinkedIn profiles and one-line reasoning.

## Goals
- Help every attendee find their highest-value connections before the networking session starts
- Eliminate random conversations — make intros intentional with specific names + reasoning
- Keep onboarding lightweight — one form, verified email, done in 60 seconds
- Deliver matches via email so attendees can prep before mingling

## Users
- **Primary:** ~50 startup founders, operators, and investors attending a Neon Fund networking event
- **Secondary:** Event organizers (Neon Fund team) who manage the event, upload attendee lists, and trigger match emails

## Problem
At networking events, people waste time on random conversations and miss the 2-3 people who could actually change their trajectory. There's no easy way to know who's in the room, what they're building, or what they need.

## Scope

### In scope (v2 — current)
- Onboarding form with email verification (2-step auth)
- Real-time email validation against Luma attendee list
- Supabase email OTP auth on form submit
- Profile storage with email as linking key
- Luma attendee list table (email + LinkedIn URL)
- Waiting screen after form submission ("sit tight, matches coming soon")
- Match algorithm (TBD) to find top 5-6 matches per attendee
- Email delivery of matches with LinkedIn links and one-line reasoning
- Admin trigger to send match emails

### In scope (future)
- Chat interface powered by Groq LLM (llama-3.3-70b-versatile) for live matchmaking Q&A
- Phone OTP auth (Supabase Auth + Twilio SMS)
- Admin dashboard to see all profiles / monitor usage
- Conversation history persistence
- Multi-event support

### Out of scope
- Direct messaging between attendees
- Calendar/meeting scheduling
- Video calls

## Key Flow

### Event timeline
- **Before event:** Organizer uploads Luma list (email + LinkedIn) to Supabase
- **Event link shared:** Via Luma email blast + QR code at event entrance
- **11:00 AM:** Event starts, attendees arrive and fill form
- **11:30 AM:** Entry closes
- **11:30–12:00:** Attendees see waiting screen ("We're finding your best matches!")
- **12:00 PM:** Match emails sent to all attendees
- **12:00+:** Networking session begins — attendees know exactly who to find

### Attendee flow
1. Guest gets link (via Luma email or QR code at event)
2. Enters email → real-time check against `luma_list` table
   - If email NOT in Luma list → inline error: "Please enter the email you used for Luma registration"
   - If email IS in Luma list → proceed to form
3. Fills onboarding form (name, company, role, building, stage, looking for, can offer, goal)
4. Clicks submit → Supabase sends email OTP for verification
5. Enters OTP → profile saved to `profiles` table
6. Sees waiting screen: "Thanks! We'll send your best matches to your email before the networking session."
7. At 12 noon → receives email with top 5-6 matches

### Match email format
```
Dear {name},

Thanks for coming to the event! Based on your profile, here are the people we think you should meet:

1. {Name} — {LinkedIn URL}
   {One-line reason why they're a match}

2. {Name} — {LinkedIn URL}
   {One-line reason why they're a match}

3. {Name} — {LinkedIn URL}
   {One-line reason why they're a match}

... (up to 5-6 matches)
```

## Requirements

### Functional
- **Luma list upload:** Admin uploads CSV with email + LinkedIn columns → stored in `luma_list` table
- **Email validation:** Real-time check on email input blur — is this email in `luma_list`?
- **Email OTP auth:** On form submit, Supabase Auth sends OTP to email → user verifies → profile saved
- **Onboarding form fields:** Email, full name, company, role, what building, stage (single-select), looking for (multi-select), can offer (multi-select), walk-away goal
- **Waiting screen:** After form submission, show confirmation + "matches coming soon" message
- **Match algorithm:** TBD — determines top 5-6 matches per attendee based on profile data
- **Email delivery:** Send formatted match email to each attendee with LinkedIn links
- **Admin trigger:** Button or API endpoint to trigger match calculation + email send

### Non-functional
- Page load < 2s on 4G
- Works on mobile Safari + Chrome (primary use case is phone at event)
- Email OTP delivery < 30 seconds
- Match emails sent to all 50 attendees within 2 minutes of trigger

## Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (Postgres + REST API + Auth)
- **Auth:** Supabase email OTP
- **Email delivery:** TBD (Resend / Supabase / other)
- **Match algorithm:** TBD
- **Deploy:** Vercel
- **Future — LLM chat:** Groq API (llama-3.3-70b-versatile) via OpenAI-compatible SDK

## Database Schema

### `luma_list` table
| Column | Type | Notes |
|--------|------|-------|
| email | text (PK) | Email used for Luma registration |
| linkedin_url | text | LinkedIn profile URL |

### `profiles` table
| Column | Type | Notes |
|--------|------|-------|
| email | text (PK) | Links to luma_list.email |
| name | text | Full name |
| company | text | Company name |
| role | text | Role/title |
| what_building | text | One-liner |
| stage | text | Idea / Pre-revenue / Revenue / Scaling |
| looking_for | text[] | Multi-select |
| can_offer | text[] | Multi-select |
| walk_away_with | text | Goal for the event |
| created_at | timestamptz | Auto-set |

## Key Files
- `src/app/page.tsx` — routing logic (form vs waiting screen)
- `src/components/OnboardingForm.tsx` — profile form with email validation + OTP
- `src/components/WaitingScreen.tsx` — post-submission waiting screen
- `src/app/api/chat/route.ts` — Groq chat endpoint (future use)
- `src/app/api/validate-email/route.ts` — checks email against luma_list
- `src/app/api/send-matches/route.ts` — triggers match calculation + email send
- `src/lib/supabase.ts` — Supabase client
- `src/lib/types.ts` — TypeScript interfaces
- `supabase-schema.sql` — database migration

## Metrics
- **Adoption:** % of Luma attendees who complete the form
- **Verification:** % who complete email OTP
- **Match quality:** Post-event survey — did you meet the people we suggested?
- **Email open rate:** % of match emails opened

## Open Questions
1. What matching algorithm/logic should we use? (TBD)
2. Which email service for sending match emails? (Resend vs Supabase vs other)
3. Should matches be mutual? (If A matches B, should B also match A?)
4. How many matches per person? (Currently 5-6)
5. Should we add a feedback loop after the event?

## Current State
- [x] Onboarding form with all profile fields
- [x] Neon Fund branding (color palette + logo)
- [x] Mobile-responsive design
- [x] 9 demo profiles seeded in Supabase
- [x] Deployed to Vercel (startup-matchmaker-kappa.vercel.app)
- [x] GitHub repo (RohanNeon/startup-matchmaker)
- [x] Chat interface with Groq LLM (built, keeping for future)
- [ ] Add email field to form + real-time Luma validation
- [ ] Supabase email OTP auth
- [ ] Create luma_list table
- [ ] Waiting screen after submission
- [ ] Match algorithm
- [ ] Email delivery system
- [ ] Admin trigger for sending matches

## Launch Checklist
- [ ] Create `luma_list` table in Supabase
- [ ] Update `profiles` table — add email as PK
- [ ] Upload Luma attendee CSV
- [ ] Enable Supabase email auth
- [ ] Add email validation + OTP to form
- [ ] Build waiting screen
- [ ] Build match algorithm
- [ ] Set up email service (Resend / other)
- [ ] Build admin trigger endpoint
- [ ] Test full flow end-to-end on mobile
- [ ] Set up custom domain (match.neon.fund)
- [ ] Prepare event-day assets (QR code pointing to app)
