@AGENTS.md

# Neon Fund — Startup Matchmaker

## What this is
AI-powered matchmaking for startup networking events (~100 attendees). Attendees fill a verified profile form → at a set time, each attendee receives an email with their top 5 best matches including LinkedIn profiles.

## First event: Agentic Infra Event (March 21, 2026, Bangalore)
- 107 invites, 29 registrations, 27 match emails sent
- Event completed successfully

## Tech stack
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Database**: Supabase (Postgres + REST API + Auth + RLS)
- **Auth**: Supabase email OTP (6-digit code)
- **Email SMTP (OTP)**: Brevo via Supabase custom SMTP
- **Email delivery (match emails)**: Brevo SMTP via nodemailer (direct)
- **Match algorithm**: Mutual benefit scoring (looking_for vs can_offer overlap)
- **Font**: Inter (Google Fonts)
- **Deploy**: Vercel (neon-matchmaker.vercel.app)
- **Domain**: neon.fund (GoDaddy)
- **GitHub**: RohanNeon/startup-matchmaker

## Branding — Neon Fund color palette (LIGHT theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neon` | #e8ff79 | Primary accent, active buttons, highlights |
| `--color-neon-dark` | #1d3d0f | Text, dark buttons, borders |
| `--color-neon-bg` | #fdfff0 | Page background, card surfaces |
| `--color-neon-hover` | #d4eb65 | Hover states |
| White | #ffffff | Card backgrounds |

Logo: `public/neon-logo.png` (also `.svg`). Lime-green "N" mark. PNG has RGBA transparency.

## Database schema (Supabase)

### `luma_list` table
- email (text, PK) - email used for Luma registration
- linkedin_url (text) - LinkedIn profile URL
- 107 attendees loaded for first event

### `profiles` table
- email (text, PK) - links to luma_list.email
- name, company, role (text, NOT NULL)
- what_building (text, nullable/optional, 100-word limit)
- looking_for, can_offer (text[]) - options: Investor, Co-founder, Customers, Talent, Peers
- created_at (timestamptz)

### `matches` table (created for event)
- id (uuid, PK)
- profile_email (text, FK to profiles)
- match_email (text, FK to profiles)
- match_rank (int) - 1-5
- score (int) - match score
- linkedin_url (text)
- created_at (timestamptz)

### `trending_events_cache` table
- id (text, PK) - cache key, e.g. "bangalore"
- events (jsonb) - array of trending event objects from Luma
- updated_at (timestamptz) - last refresh time

## Match algorithm
Mutual benefit scoring system:
- A's looking_for matches B's can_offer = 3 points per overlap
- B's looking_for matches A's can_offer = 3 points per overlap
- Mutual benefit bonus: +5 if both sides get something
- Category diversity bonus: +1 per unique category matched
- Same company filter: excluded from matching
- Top 5 matches per person, sorted by score descending

## Core data flow
1. Organizer uploads Luma CSV (email + LinkedIn) → stored in `luma_list`
2. Attendees get link via email or QR code at event door
3. Enter email → real-time validation against `luma_list`
   - Not found → "Please enter the email you used for Luma registration"
   - Found → proceed to form
4. Fill form fields → click submit → Supabase sends email OTP (6-digit)
5. Verify OTP → profile saved to `profiles` table via upsert
6. See waiting screen: "We'll email your best matches!"
7. Admin triggers match computation → stored in `matches` table
8. Admin triggers email send → each attendee gets top 5 matches via Brevo SMTP

## API endpoints
- `POST /api/validate-email` - checks email against luma_list
- `POST /api/compute-matches` - runs match algorithm, stores in matches table (admin key required)
- `POST /api/send-match-emails` - sends match emails via Brevo (admin key required, supports targetEmail for single sends)
- `POST /api/send-matches` - legacy endpoint
- `POST /api/trigger-my-matches` - legacy single-person trigger
- `POST /api/chat` - Groq LLM chat (future use)
- `GET /api/trending-events` - returns cached trending Luma events (auto-refreshes if stale)
- `POST /api/trending-events` - force-refresh trending events cache from Luma

## Two-step auth
1. **Email validation (pre-submit):** On email input blur, check against `luma_list` in real-time
2. **Email OTP (on submit):** Supabase Auth sends 6-digit OTP. User verifies before profile is saved
3. **Duplicate check:** Before sending OTP, check if email already has a profile → show "already registered" message
4. **Resend OTP:** 60-second cooldown, button in OTP screen

## File structure
```
src/
├── app/
│   ├── page.tsx                        # Root - routes to form or waiting screen
│   ├── layout.tsx                      # Root layout, Inter font, metadata
│   ├── globals.css                     # Tailwind + Neon theme tokens
│   ├── api/chat/route.ts               # POST /api/chat - Groq LLM (future)
│   ├── api/validate-email/route.ts     # POST - checks email against luma_list
│   ├── api/send-matches/route.ts       # POST - legacy match send
│   ├── api/compute-matches/route.ts    # POST - compute & store matches
│   ├── api/send-match-emails/route.ts  # POST - send match emails (with targetEmail filter)
│   ├── api/trigger-my-matches/route.ts # POST - legacy single trigger
│   ├── api/trending-events/route.ts   # GET/POST - Luma trending events feed
│   ├── admin/page.tsx                 # Admin dashboard with metrics, events, trending
│   ├── admin/layout.tsx               # Admin layout with auth, header, navigation
│   ├── admin/settings/page.tsx        # Admin settings (manage admins)
│   ├── admin/event/[slug]/page.tsx    # Per-event dashboard (participants, guests, matches, emails)
├── components/
│   ├── OnboardingForm.tsx              # Profile form with email validation + OTP
│   ├── WaitingScreen.tsx               # Post-submission waiting screen
│   └── ChatInterface.tsx               # Chat UI (kept for future)
├── lib/
│   ├── supabase.ts                     # Supabase client init
│   └── types.ts                        # TypeScript interfaces
```

## Onboarding form fields
- Email * (validated against luma_list on blur, duplicate check before OTP)
- Full name *, Company *, Role * (text inputs)
- What are you building? (textarea, optional, 100-word limit)
- Looking for *: Investor / Co-founder / Customers / Talent / Peers (multi-select chips)
- Can offer *: same options (multi-select chips)
- (* = required, shown with red asterisk)

## Match email format
- Branded HTML email with Neon Fund logo
- Shows top 5 matches with: Name, Role at Company, "Interested in: [can_offer tags]", LinkedIn Profile link
- YouTube podcast section at bottom with 3 thumbnails linking to be.neon.fund tracking URLs
- Responsive: horizontal layout on desktop, vertical stack on mobile

## Podcast links in match email
1. Rohit Agarwal: https://be.neon.fund/Rohit-Agarwal-Agentic-Infra-Event
2. Sudarshan Kamath: https://be.neon.fund/sudarshan-kamath-Agentic-Infra-Event
3. Ashu Garg: https://be.neon.fund/Ashu-Garg-Agentic-Infra-Event

## Environment variables
### .env.local (local dev)
- `NEXT_PUBLIC_SUPABASE_URL` - https://iuxpiutfhskitcaesyjk.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - for admin operations
- `BREVO_SMTP_USER` - a56b31001@smtp-brevo.com
- `BREVO_SMTP_PASS` - Brevo SMTP key
- `GROQ_API_KEY` - Groq API key (future use)

### Vercel env vars (production)
- Same as above, all 3 server-side keys added: SUPABASE_SERVICE_ROLE_KEY, BREVO_SMTP_USER, BREVO_SMTP_PASS

## Brevo SMTP (email delivery)
- Provider: Brevo (formerly Sendinblue), free tier - 300 emails/day (resets daily)
- SMTP: smtp-relay.brevo.com, port 587
- Username: a56b31001@smtp-brevo.com
- Sender: Neon Fund <rohan@neon.fund>
- Domain: neon.fund hosted on GoDaddy
- **DNS records added in GoDaddy:**
  - TXT `@` → `brevo-code:b466a3c5d632c2c9b4fe6678a2ad65eb`
  - CNAME `brevo1._domainkey` → `b1.neon-fund.dkim.brevo.com`
  - CNAME `brevo2._domainkey` → `b2.neon-fund.dkim.brevo.com`
  - TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
- All DNS records verified and propagated

## Deployment
- **Vercel:** neon-matchmaker.vercel.app (primary)
- **Old URL:** startup-matchmaker-kappa.vercel.app (307 redirects to new)
- **GitHub:** RohanNeon/startup-matchmaker
- Auto-deploys on every push to main
- Uses `--webpack` flag (Turbopack crashes in dev due to PATH issues)

## Dev server
- launch.json uses `/bin/bash -c` with explicit PATH export + `node node_modules/.bin/next dev --webpack`
- Port 3000

## Current state (post-event)
- [x] Onboarding form with all fields + validation + asterisks on required
- [x] Neon Fund branding (colors, transparent logo, Inter font)
- [x] Mobile-responsive design
- [x] Deployed to Vercel (neon-matchmaker.vercel.app)
- [x] GitHub repo connected (RohanNeon/startup-matchmaker)
- [x] Chat interface with Groq LLM (built, kept for future)
- [x] Email field + real-time Luma list validation (on blur)
- [x] Supabase email OTP auth (6-digit code)
- [x] Brevo SMTP connected (300 emails/day free)
- [x] Branded OTP email template (Neon Fund logo, lime-green code box)
- [x] luma_list table with 107 attendees
- [x] Waiting screen after form submission
- [x] Duplicate profile check before sending OTP
- [x] Upsert on profile save
- [x] Removed stage + walk_away_with fields, what_building optional (100-word limit)
- [x] Resend OTP button with 60-second cooldown
- [x] DNS records for Brevo (SPF + DKIM + DMARC in GoDaddy)
- [x] Match algorithm (mutual benefit scoring)
- [x] Match computation API (compute-matches)
- [x] Match email delivery via Brevo SMTP (send-match-emails with targetEmail filter)
- [x] Matches table in Supabase
- [x] YouTube podcast thumbnails in match email (responsive)
- [x] Vercel domain changed to neon-matchmaker.vercel.app
- [x] Old URL redirects to new
- [x] Header with Neon logo + "Startup Matchmaker" text side by side
- [x] First event completed (March 21, 2026)
- [x] Multi-event support (events table, event_id foreign keys)
- [x] Second event: Cybersecurity AI (May 28, 2026)
- [x] Admin dashboard with Google OAuth (@neon.fund domain lock)
- [x] Admin role system (super_admin vs viewer, hardcoded + dynamic admins table)
- [x] Dashboard metrics (total events, guests, registered, matchups, conversion, repeat attendees)
- [x] Event calendar in sidebar
- [x] Trending events feed from Luma (auto-refresh 8am + 5pm IST via Vercel cron)
- [x] Per-event dashboard with 5 tabs (Registered, Guest List, Check-ins, MatchUp, Email Controls)
- [x] CSV + Excel guest list upload (drag & drop, SheetJS parsing)
- [x] Luma import for event creation (fetch event details from Luma URL)
- [x] Luma links on events (header "+ Create on Luma", per-event Luma page links)
- [x] Admin settings page (manage admin users via OTP)
- [x] Font contrast fixed across all admin pages (min /40 opacity on white)
- [x] Brand-only color system enforced (no red/green/blue, only #1d3d0f opacity variants)

## Key decisions
1. **v2 pivot:** Replaced live chat with email-based match delivery
2. **Two-step auth:** Email validation against Luma list + email OTP
3. **Email as PK:** Email links profiles to luma_list
4. **Groq chat kept:** Saved for future use
5. **Mutual benefit scoring:** Match algorithm weights bidirectional value exchange
6. **No form close:** Form stays open, no hard cutoff
7. **Brevo over Supabase built-in email:** 300/day vs 30/hour cap
8. **Duplicate check before OTP:** Saves email tokens
9. **Upsert over insert:** Handles edge cases
10. **Separate compute + send:** Match computation and email sending are separate API calls for control
11. **targetEmail filter:** send-match-emails supports sending to a single person for testing
12. **Nodemailer for match emails:** Direct SMTP via nodemailer, not Supabase email

---

## EVENT 1 DATA: Agentic Infra Event (March 21, 2026, Bangalore)

### Event Funnel
| Stage | Count | Rate |
|-------|-------|------|
| Luma invites sent | 107 | - |
| Attendees at event | [TBD] | - |
| Form link reached (email + QR) | 44 | 41% of invites |
| - Via email link clicks | 24 | - |
| - Via QR code scans at desk | 20 | - |
| OTP requested (form submitted) | 30 | 68% of reach |
| OTP verified + profile saved | 29 | 97% of OTP sent |
| Abandoned (OTP sent, didn't finish) | 2 | aprohith@gmail.com, martipradyumna@gmail.com |
| Pre-form drop-off (opened but didn't submit) | 14 | 32% of reach |
| Match emails sent | 29 | 100% of registered |
| Podcast link clicks (from guests) | 0 | 0% |

### Conversion rates
| Step | Rate |
|------|------|
| Invite → Form opened | 41% |
| Form opened → OTP requested | 68% |
| OTP requested → Completed | 97% |
| Invite → Completed | 27% |
| Form opened → Completed | 66% |

### Registration breakdown
| Category | Count |
|----------|-------|
| Total registrations | 29 |
| Neon Fund team | 7 |
| External attendees | 22 |
| Unique companies | 24 |

### Role breakdown (external only)
| Role | Count | % |
|------|-------|---|
| Founder/CEO | 12 | 55% |
| Engineer/CTO | 8 | 36% |
| Manager/CPO/VP | 3 | 14% |

### What people are LOOKING FOR
| Category | Count | % |
|----------|-------|---|
| Peers | 17 | 59% |
| Investor | 14 | 48% |
| Talent | 14 | 48% |
| Customers | 9 | 31% |
| Co-founder | 7 | 24% |

### What people CAN OFFER
| Category | Count | % |
|----------|-------|---|
| Peers | 18 | 62% |
| Talent | 13 | 45% |
| Investor | 12 | 41% |
| Customers | 8 | 28% |
| Co-founder | 7 | 24% |

### Demand vs Supply gap (external only)
| Category | Looking For | Can Offer | Gap |
|----------|-------------|-----------|-----|
| Investor | 12 | 10 | +2 (demand > supply) |
| Customers | 8 | 8 | 0 (balanced) |
| Talent | 11 | 11 | 0 (balanced) |
| Co-founder | 3 | 6 | -3 (supply > demand) |
| Peers | 12 | 12 | 0 (balanced) |

### What they're building - themes
| Theme | Count | Founders |
|-------|-------|----------|
| Agentic AI | 5 | Cogniqa, Wizcommerce, Grovio AI, Stealth, navsi.ai |
| AI SaaS (vertical) | 5 | Friday Intellytics, Raasta.io, Stealth, navsi.ai, Refringence |
| AI Infrastructure | 3 | Cogniqa, TrueFoundry, navsi.ai |
| AI Marketing | 3 | Luminary Lanr, Grovio AI, VS |
| DevTools/Privacy | 2 | JUSPAY, CoStrategix |
| Hardware AI | 1 | Refringence |
| **AI vs Non-AI** | **86% AI** | 12/14 who shared are building with AI |

### Founders seeking investors (warm pipeline - 12)
1. Srinivas Venkatesan (Cogniqa) - Trust Infra Stack for Agentic Web
2. Raveen Beemsingh (Luminary Lanr) - AI CMO 24x7
3. Arunima V. Jayadevan (Bridge AI) - not shared
4. Anshum Jani (Automation Anywhere) - not shared
5. Mukesh KG (Friday Intellytics) - AI Assistant for Data Analytics
6. Veer Porwal (Tunegrid) - not shared
7. Manish Kumar (Checksum Labs) - not shared
8. Amit Kumar (Grovio AI) - AI agentic marketing tech
9. Nikhil Gundawar (Stealth) - Agentic AI Analytics platform
10. Saurabh Jain (Vink) - not shared
11. Sourabh Kapure (navsi.ai) - Agentic AI infra for B2B SaaS
12. Jyothish Vijay (Refringence) - AI hardware design suite

### Email delivery (Brevo)
- Total emails sent on event day: ~59 (30 OTP + 29 match)
- 105 total emails last 7 days (includes testing)
- Delivery: 100% (no bounces)
- Spam issue: some attendees reported OTP landing in spam (first-time sending domain, no warm-up)
- "via sendinblue.com" only showed for @neon.fund recipients (same-domain sender issue), not for external Gmail users

### Known issues during event
1. **OTP in spam** - some attendees had to check spam folder (new sending domain, no warm-up)
2. **DKIM not fully verified during event** - DNS records were added March 20 evening, Brevo verification was still pending during March 21 morning
3. **targetEmail filter bug** - first version of send-match-emails didn't properly filter, causing accidental batch send. Fixed mid-event
4. **"via sendinblue.com"** - only appeared for @neon.fund recipients, not external

### Brevo email logs (March 21-22)
- CSV exported from Brevo transactional logs
- File: /Users/rohanverma/Downloads/Brevo Logs (1).csv

### Reports to create
1. **Report 1: Data Insights for VC** - event funnel, attendee breakdown, sector analysis, demand/supply, deal pipeline
2. **Report 2: App Deployment Report** - what went wrong, spam issues, DNS, build failures
3. **Report 3: PRD Update** - what was built, what's next

### Report 1 structure (Google Doc)
- Page 1: Executive Summary (key stats)
- Page 2: Event Snapshot (funnel, registration timeline)
- Page 3: Attendee Profile Breakdown (by role, company type)
- Page 4: What They're Building (themes, AI vs non-AI)
- Page 5: Demand vs Supply Matrix
- Page 6: Most Connected Profiles (match engagement)
- Page 7: VC Deal Pipeline Signals (founders seeking investors, sector clusters)
- Page 8: Recommendations for Next Event

## Report 2: What Went Wrong (Deployment & Event Issues)

### Issue 1: OTP emails landing in spam
**Severity: HIGH** | Multiple attendees had to check spam folder
- Root cause: DNS records (DKIM/DMARC) added evening before event, not verified by morning. New sending domain with zero reputation. No warm-up.
- Fix: Add DNS 1 week before. Verify all green in Brevo. Send test emails to Gmail/Outlook/Yahoo days before. Warm up domain with daily emails for a week.

### Issue 2: Nobody filled via email link, most used QR
**Severity: MEDIUM** | 24 email clicks vs 20 QR scans, but most completions from QR
- Root cause: Luma email easily ignored. QR at venue has social pressure + timing advantage.
- Fix: Share link on WhatsApp/Telegram closer to event. Reminder SMS 30 min before. Bigger QR on standees.

### Issue 3: Match emails sent to everyone instead of just one person (CRITICAL)
**Severity: CRITICAL** | All 27 people received match emails when only 1 should have
- Root cause: `send-match-emails` API had no working `targetEmail` filter. No confirmation step. No dry run mode.
- Fix: targetEmail filter fixed. Add dryRun param. Add confirmation step ("About to send to 27, confirm?"). Add send_log table. Rate limit batch sends.

### Issue 4: Udit received OTP 1 hour late
**Severity: HIGH** | At least 1 attendee had severely delayed OTP
- Root cause: Brevo free tier has no delivery SLA. Shared IP queuing. Gmail delay for untrusted senders.
- Fix: Upgrade Brevo or switch to SendGrid/Resend. Monitor delivery in real-time. Add manual OTP override for admin.

### Issue 5: Matches felt generic - "who I shared" not "who is relevant"
**Severity: HIGH** | Attendees felt matches weren't personalized enough
- Root cause: Algorithm only uses 5 category chips (looking_for vs can_offer). what_building text not used. 29 people is small pool. No industry/stage matching.
- Fix: Add text similarity from what_building. More form fields (industry, stage, specific interests). Use LLM for match reasoning. Add "who do you already know" field. With 100+ attendees, algorithm has more room.

### Issue summary
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | OTP in spam | HIGH | DNS fixed, needs warm-up |
| 2 | Nobody used email link | MEDIUM | Behavioral, use WhatsApp |
| 3 | Batch send instead of single | CRITICAL | Code fixed |
| 4 | OTP delayed 1 hour | HIGH | Need provider upgrade |
| 5 | Match quality too generic | HIGH | Algorithm needs improvement |

## Report 3: PRD - v2 Roadmap, Tech Debt & Ops Playbook

### v2 Roadmap (Next Event)

#### P0 - Must have before next event
1. **Better match algorithm**
   - Use `what_building` text for semantic similarity (embeddings or keyword matching)
   - Use LLM (Groq) to generate personalized match reasoning per pair
   - Weight mutual benefit higher, penalize one-sided matches
2. **Email warm-up protocol**
   - Verify DNS/DKIM/DMARC 1 week before event
   - Send 10-20 test emails daily for 5 days before to warm up domain
   - Test inbox delivery on Gmail, Outlook, Yahoo before event
3. **Safe batch send**
   - Add `dryRun=true` parameter (shows what would be sent without sending)
   - Add confirmation step ("About to send to N people, confirm?")
   - Add `send_log` table (timestamp, target email, match count, status)
   - Rate limit: max 1 batch send per hour
4. **Manual OTP override**
   - Admin endpoint to generate and share OTP code directly if email is delayed
   - Fallback for Brevo delays

#### P1 - Should have
5. **More form fields**
   - Industry/sector dropdown
   - Company stage (idea, MVP, revenue, growth, established)
   - Specific interests (free text: "looking for AI infra advice")
   - "Who do you already know here?" (avoid matching existing connections)
6. **WhatsApp/SMS distribution**
   - Share form link via WhatsApp broadcast or Twilio SMS
   - Higher open rate than Luma email
7. **Admin dashboard**
   - See registrations live (count, names, timeline)
   - Trigger compute + send from UI (not API call)
   - View match results before sending
   - Monitor email delivery status
8. **Custom domain**
   - match.neon.fund instead of neon-matchmaker.vercel.app
   - CNAME record in GoDaddy → cname.vercel-dns.com

#### P2 - Nice to have
9. **Post-event feedback**
   - "Did you meet your matches?" email 24h after event
   - Rate match quality (1-5 stars)
   - Track actual connections made
10. **Match quality scoring**
    - Track LinkedIn clicks from match emails
    - Measure which match positions (1st, 2nd, 3rd) get most clicks
    - A/B test different match counts (5 vs 3 vs 7)
11. **Chat interface revival**
    - Groq LLM for post-match follow-up
    - "Tell me more about Srinivas from Cogniqa"
    - Already built (ChatInterface.tsx), needs integration
12. **Multi-event support**
    - Reuse profiles across events
    - Event-specific luma_list + matches tables
    - "You've been to 3 Neon events" loyalty tracking

### Technical Debt

1. **Cleanup legacy endpoints**
   - Remove or deprecate: `/api/trigger-my-matches`, `/api/send-matches`
   - Keep only: `/api/compute-matches`, `/api/send-match-emails`
2. **Add send_log table**
   - Schema: id, event_date, target_email, match_count, status, sent_at
   - Audit trail for every email sent
3. **Error monitoring**
   - Add Sentry or similar for runtime errors
   - Alert on failed email sends
   - Monitor Brevo quota usage
4. **Test suite for match algorithm**
   - Unit tests: score computation, same-company filtering, ranking
   - Integration tests: compute-matches API with mock data
   - Edge cases: 1 profile, 2 profiles, all same looking_for
5. **Environment variable validation**
   - Check all required env vars on startup
   - Fail fast with clear error message if missing
6. **Neon logo**
   - Get original high-res logo from design team
   - Current PNG was regenerated, may not match exact brand mark

### Event Ops Playbook

#### 1 week before event
- [ ] Upload Luma CSV to `luma_list` table
- [ ] Verify DNS records (DKIM, DMARC, SPF) are green in Brevo
- [ ] Start domain warm-up (send 10-20 emails/day)
- [ ] Test full flow: form → OTP → verify → waiting screen
- [ ] Test OTP delivery on Gmail, Outlook, Yahoo
- [ ] Prepare QR code pointing to form URL
- [ ] Update podcast links in match email template if needed

#### 1 day before event
- [ ] Send 20+ warm-up emails to confirm inbox delivery
- [ ] Verify Brevo quota is 300 (resets daily)
- [ ] Check Vercel deployment is healthy
- [ ] Truncate profiles table (clean slate)
- [ ] Share form link via WhatsApp/email to attendees
- [ ] Print QR codes for registration desk

#### Day of event (morning)
- [ ] Monitor registrations in Supabase (profiles table count)
- [ ] Check Brevo dashboard for delivery issues
- [ ] Have manual OTP override ready (if email delayed)
- [ ] Keep form open until cutoff time

#### Day of event (match time)
- [ ] Run `/api/compute-matches` to generate matches
- [ ] Review matches in Supabase `matches` table
- [ ] Do a `dryRun=true` send to verify counts
- [ ] Send test email to organizer's personal Gmail first
- [ ] Confirm test email looks good on mobile + desktop
- [ ] Trigger batch send to all registered attendees
- [ ] Monitor Brevo for delivery status

#### After event
- [ ] Export profiles and matches tables (CSV)
- [ ] Check Brevo logs for bounces/failures
- [ ] Send feedback email (24h later)
- [ ] Generate event report (data insights + issues)
- [ ] Save all data to CLAUDE.md for next session

## Multi-Event Support (implemented)

### events table
- id (uuid, PK), slug (text, unique), name (text), event_date (date), location (text), is_active (boolean), created_at (timestamptz)
- All existing tables (luma_list, profiles, matches) have nullable event_id column
- Event 1 data has event_id = NULL (untouched)
- New events get explicit event_id

### Event-scoped API endpoints
- `GET/POST /api/events` - list/create events (admin only for POST)
- `POST /api/event-validate-email` - checks email against luma_list for specific event
- `POST /api/event-compute-matches` - computes matches for specific event only
- `POST /api/event-send-match-emails` - sends match emails for specific event, HARD GUARDRAIL: default is dry run, batch send requires confirm: "SEND_ALL"

### Dynamic event form
- `/event/[slug]` - event-scoped registration form
- EventOnboardingForm component with event_id context
- localStorage scoped per event (`profile_email_{eventId}`)

### Event 2: Cybersecurity AI (May 28, 2026)
- Event ID: 374ad09b-576f-4c2d-b8bd-933e8494cd03
- Slug: cybersecurity-ai
- 99 guests in luma_list (94 from CSV + 5 manual Neon team adds)
- Form options: Looking for (Capital, Co-founder, Customers, Talent, Peers, Startups), Can offer (Capital, Co-founder, Customers, Talent, Peers)
- Podcast links in match email: Manish, Animesh, Sudheesh (be.neon.fund tracking URLs)

## Admin Dashboard

### Architecture
- **Route**: `/admin` (protected with Google OAuth, @neon.fund domain only)
- **Auth**: Supabase Google OAuth + role-based access (super_admin vs viewer)
- **Super admins**: Hardcoded list (`rohan@neon.fund`, `nansi@neon.fund`, `shikhar@neon.fund`) + dynamic `admins` table
- **Features**:
  1. Dashboard metrics — total events, guests, registered, matchups, conversion, repeat attendees
  2. Event calendar — mini calendar showing event dates
  3. Trending events — Luma-powered feed of upcoming AI/VC/startup events in Bangalore
  4. Event list — all events with stats, Luma links, image thumbnails
  5. Create event — import from Luma URL or manual entry, CSV/Excel guest upload
  6. Per-event view — 5 tabs: Registered, Guest List, Check-ins, MatchUp, Email Controls
  7. Settings — manage admin users (add/remove via OTP verification)

### Admin pages
- `/admin` — dashboard with metrics, calendar, trending events, event list, create event
- `/admin/event/[slug]` — per-event dashboard (5-tab layout: participants, guests, check-ins, matches, emails)
- `/admin/settings` — manage admin users (super_admin only)

### Trending Events (Luma integration)
- API: `/api/trending-events` fetches from Luma discover API for Bangalore
- Filters by 35+ keywords: AI, startup, founder, VC, venture, agentic, SaaS, hackathon, deeptech, etc.
- Cached in `trending_events_cache` table (6hr TTL)
- Auto-refreshes via Vercel cron at 8am and 5pm IST (`vercel.json`)
- UI: sidebar section below calendar, shows date badge + event name + host + time
- Links open Luma event page in new tab

### Luma integration
- Header: "+ Create on Luma" button links to `https://lu.ma/create`
- Per-event: "Luma" link in event header (stored in `events.luma_url` column)
- Event logos: `public/luma-logo.png` (512x512 Luma sparkle icon)
- Create event: "Import from Luma" fetches event details from Luma URL via `/api/fetch-luma-event`

### Brand color rules for admin
- Only 5 colors: #e8ff79, #1d3d0f, #fdfff0, #000000, #ffffff
- Do NOT use #e8ff79 for chart bars/fills (too light) — use #1d3d0f with opacity
- Text contrast: minimum opacity /40 on white backgrounds, /50+ for readable text
- Opacity hierarchy: /65 body text, /60 secondary, /55 labels, /50 tertiary, /45 timestamps, /40 decorative

### New tables needed
- `send_log` — id, event_id, target_email, match_count, status, sent_at
