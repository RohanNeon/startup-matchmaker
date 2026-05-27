import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_PASS!,
    },
  });
}

interface Profile {
  email: string;
  name: string;
  company: string;
  role: string;
  looking_for: string[];
  can_offer: string[];
}

interface StoredMatch {
  match_email: string;
  match_rank: number;
  score: number;
  linkedin_url: string | null;
}

function buildEmailHtml(
  recipientName: string,
  eventName: string,
  matches: { profile: Profile; linkedin: string | null; rank: number }[]
): string {
  const matchRows = matches
    .map((m) => {
      const linkedinLink = m.linkedin
        ? `<a href="${m.linkedin}" style="color: #1d3d0f; text-decoration: underline;">LinkedIn Profile</a>`
        : "";
      const interests = m.profile.can_offer?.join(", ") || "";
      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid rgba(29,61,15,0.08);">
            <div style="font-size: 15px; font-weight: 600; color: #1d3d0f; margin-bottom: 2px;">
              ${m.rank}. ${m.profile.name}
            </div>
            <div style="font-size: 13px; color: #1d3d0f99; margin-bottom: 4px;">
              ${m.profile.role} at ${m.profile.company}
            </div>
            ${interests ? `<div style="font-size: 13px; color: #1d3d0f; margin-bottom: 4px;">
              <span style="background: #e8ff79; padding: 2px 8px; border-radius: 6px; font-weight: 500;">Interested in: ${interests}</span>
            </div>` : ""}
            ${linkedinLink ? `<div style="margin-top: 6px; font-size: 13px;">${linkedinLink}</div>` : ""}
          </td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" />
<style>
  @media only screen and (max-width: 480px) {
    .video-cell { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #fdfff0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://neon-matchmaker.vercel.app/neon-logo-email.png" alt="Neon Fund" width="48" height="48" style="margin-bottom: 12px; border-radius: 8px;" />
      <h1 style="color: #1d3d0f; font-size: 22px; font-weight: 700; margin: 0;">Your Top Matches</h1>
      <p style="color: #1d3d0f99; font-size: 14px; margin: 8px 0 0;">Neon Fund | ${eventName}</p>
    </div>
    <div style="background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid rgba(29,61,15,0.1);">
      <p style="color: #1d3d0f; font-size: 15px; margin: 0 0 4px;">Hi ${recipientName} 👋</p>
      <p style="color: #1d3d0f; font-size: 14px; margin: 0 0 20px; line-height: 1.5;">
        Based on your profile, here are the people we think you should meet today. Go find them!
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        ${matchRows}
      </table>
    </div>
    <p style="text-align: center; color: #1d3d0f40; font-size: 12px; margin-top: 24px;">
      &copy; Neon Fund | Startup Matchmaker
    </p>
  </div>
</body>
</html>`;
}

// POST /api/event-send-match-emails
// Body: { adminKey, eventId, targetEmail?, dryRun? }
export async function POST(request: Request) {
  const body = await request.json();
  const { adminKey, eventId, targetEmail, confirm } = body;

  if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!eventId) {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  // HARD GUARDRAIL: Default is always dry run.
  // Must pass confirm: true AND targetEmail to send to one person,
  // or confirm: "SEND_ALL" (exact string) to send to everyone.
  const isDryRun = !confirm;
  const isBatchSend = !targetEmail;

  if (isBatchSend && confirm && confirm !== "SEND_ALL") {
    return NextResponse.json(
      {
        error: "BATCH SEND BLOCKED. To send to ALL attendees, pass confirm: \"SEND_ALL\" (exact string). To send to one person, pass targetEmail + confirm: true. Run without confirm first to see a dry run.",
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Verify event exists
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, slug, name")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const transporter = getTransporter();

  // Get profiles ONLY for this event
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("event_id", eventId);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "No profiles found for this event" }, { status: 200 });
  }

  const profileMap = new Map<string, Profile>();
  for (const p of profiles as Profile[]) {
    profileMap.set(p.email, p);
  }

  // Get matches ONLY for this event
  const { data: allMatches } = await supabaseAdmin
    .from("matches")
    .select("profile_email, match_email, match_rank, score, linkedin_url")
    .eq("event_id", eventId)
    .order("match_rank", { ascending: true });

  if (!allMatches || allMatches.length === 0) {
    return NextResponse.json(
      { error: "No matches computed yet. Run /api/event-compute-matches first." },
      { status: 200 }
    );
  }

  // Group matches by profile_email
  const matchesByProfile = new Map<string, StoredMatch[]>();
  for (const m of allMatches) {
    const existing = matchesByProfile.get(m.profile_email) || [];
    existing.push({
      match_email: m.match_email,
      match_rank: m.match_rank,
      score: m.score,
      linkedin_url: m.linkedin_url,
    });
    matchesByProfile.set(m.profile_email, existing);
  }

  const results: { email: string; status: string; matchCount: number }[] = [];

  for (const [profileEmail, storedMatches] of matchesByProfile) {
    // If targetEmail is specified, only send to that person
    if (targetEmail && profileEmail !== targetEmail) {
      continue;
    }

    const recipient = profileMap.get(profileEmail);
    if (!recipient) {
      results.push({ email: profileEmail, status: "skipped_no_profile", matchCount: 0 });
      continue;
    }

    const enrichedMatches = storedMatches
      .map((sm) => {
        const matchProfile = profileMap.get(sm.match_email);
        if (!matchProfile) return null;
        return {
          profile: matchProfile,
          linkedin: sm.linkedin_url,
          rank: sm.match_rank,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (enrichedMatches.length === 0) {
      results.push({ email: profileEmail, status: "skipped_no_valid_matches", matchCount: 0 });
      continue;
    }

    // HARD GUARDRAIL: Dry run unless explicitly confirmed
    if (isDryRun) {
      results.push({ email: profileEmail, status: "dry_run", matchCount: enrichedMatches.length });
      continue;
    }

    const html = buildEmailHtml(recipient.name, event.name, enrichedMatches);

    try {
      await transporter.sendMail({
        from: '"Neon Fund" <rohan@neon.fund>',
        to: profileEmail,
        subject: `Your Top ${enrichedMatches.length} Matches | ${event.name}`,
        html,
      });
      results.push({ email: profileEmail, status: "sent", matchCount: enrichedMatches.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ email: profileEmail, status: `error: ${message}`, matchCount: 0 });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const dryRunCount = results.filter((r) => r.status === "dry_run").length;

  return NextResponse.json({
    event: event.name,
    eventId,
    mode: isDryRun ? "DRY_RUN (no emails sent)" : "LIVE",
    total: results.length,
    sent,
    dryRunCount,
    ...(isDryRun && {
      next_step: targetEmail
        ? "To send for real, add confirm: true"
        : "To send to ALL, add confirm: \"SEND_ALL\" — are you sure?",
    }),
    results,
  });
}
