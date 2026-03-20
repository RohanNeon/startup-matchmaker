import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");

interface Profile {
  email: string;
  name: string;
  company: string;
  role: string;
  what_building: string | null;
  looking_for: string[];
  can_offer: string[];
}

interface Match {
  profile: Profile;
  linkedin: string | null;
  score: number;
  reasons: string[];
}

function computeMatches(
  me: Profile,
  others: Profile[],
  lumaMap: Map<string, string | null>
): Match[] {
  const scored: Match[] = [];

  for (const other of others) {
    if (other.email === me.email) continue;

    let score = 0;
    const reasons: string[] = [];

    const theyOfferWhatINeed = me.looking_for.filter((l) =>
      other.can_offer.includes(l)
    );
    if (theyOfferWhatINeed.length > 0) {
      score += theyOfferWhatINeed.length * 3;
      reasons.push(`Can offer you: ${theyOfferWhatINeed.join(", ")}`);
    }

    const iOfferWhatTheyNeed = other.looking_for.filter((l) =>
      me.can_offer.includes(l)
    );
    if (iOfferWhatTheyNeed.length > 0) {
      score += iOfferWhatTheyNeed.length * 2;
      reasons.push(`Looking for: ${iOfferWhatTheyNeed.join(", ")}`);
    }

    if (theyOfferWhatINeed.length > 0 && iOfferWhatTheyNeed.length > 0) {
      score += 2;
    }

    if (score === 0) continue;

    scored.push({
      profile: other,
      linkedin: lumaMap.get(other.email) ?? null,
      score,
      reasons,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

function buildEmailHtml(recipientName: string, matches: Match[]): string {
  const matchRows = matches
    .map((m, i) => {
      const linkedinLink = m.linkedin
        ? `<a href="${m.linkedin}" style="color: #1d3d0f; text-decoration: underline;">LinkedIn Profile</a>`
        : "";
      const interests = m.profile.can_offer?.join(", ") || "";
      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid rgba(29,61,15,0.08);">
            <div style="font-size: 15px; font-weight: 600; color: #1d3d0f; margin-bottom: 2px;">
              ${i + 1}. ${m.profile.name}
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
      <img src="https://startup-matchmaker-kappa.vercel.app/neon-logo-email.png" alt="Neon Fund" width="48" height="48" style="margin-bottom: 12px; border-radius: 8px;" />
      <h1 style="color: #1d3d0f; font-size: 22px; font-weight: 700; margin: 0;">Your Top Matches</h1>
      <p style="color: #1d3d0f99; font-size: 14px; margin: 8px 0 0;">Neon Fund | Startup Matchmaker</p>
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
    <div style="background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid rgba(29,61,15,0.1); margin-top: 20px;">
      <p style="color: #1d3d0f; font-size: 14px; font-weight: 600; margin: 0 0 4px;">While you wait to connect...</p>
      <p style="color: #1d3d0f99; font-size: 13px; margin: 0 0 16px;">Hear from founders who've been in your shoes.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="video-cell" style="width: 33%; padding: 0 4px 0 0; vertical-align: top;">
            <a href="https://www.youtube.com/watch?v=lSgxAKaeREw" style="text-decoration: none;">
              <img src="https://img.youtube.com/vi/lSgxAKaeREw/maxresdefault.jpg" alt="Podcast episode" width="100%" style="border-radius: 8px; display: block;" />
            </a>
          </td>
          <td class="video-cell" style="width: 33%; padding: 0 4px; vertical-align: top;">
            <a href="https://www.youtube.com/watch?v=BpZfUm7vonE" style="text-decoration: none;">
              <img src="https://img.youtube.com/vi/BpZfUm7vonE/maxresdefault.jpg" alt="Podcast episode" width="100%" style="border-radius: 8px; display: block;" />
            </a>
          </td>
          <td class="video-cell" style="width: 33%; padding: 0 0 0 4px; vertical-align: top;">
            <a href="https://www.youtube.com/watch?v=bQyUqWMSDho" style="text-decoration: none;">
              <img src="https://img.youtube.com/vi/bQyUqWMSDho/maxresdefault.jpg" alt="Podcast episode" width="100%" style="border-radius: 8px; display: block;" />
            </a>
          </td>
        </tr>
      </table>
    </div>
    <p style="text-align: center; color: #1d3d0f40; font-size: 12px; margin-top: 24px;">
      © Neon Fund | Startup Matchmaker
    </p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all profiles
  const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
  if (!profiles || profiles.length < 2) {
    return NextResponse.json({ error: "Not enough profiles for matching" }, { status: 200 });
  }

  const me = profiles.find((p: Profile) => p.email === email);
  if (!me) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch luma_list for LinkedIn URLs
  const { data: lumaList } = await supabaseAdmin
    .from("luma_list")
    .select("email, linkedin_url");

  const lumaMap = new Map<string, string | null>();
  if (lumaList) {
    for (const entry of lumaList as { email: string; linkedin_url: string | null }[]) {
      lumaMap.set(entry.email, entry.linkedin_url);
    }
  }

  const matches = computeMatches(me as Profile, profiles as Profile[], lumaMap);

  if (matches.length === 0) {
    return NextResponse.json({ status: "no_matches" });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_PASS!,
    },
  });

  const html = buildEmailHtml(me.name, matches);

  await transporter.sendMail({
    from: '"Neon Fund" <rohan@neon.fund>',
    to: email,
    subject: `🤝 Your Top ${matches.length} Matches | Neon Fund`,
    html,
  });

  return NextResponse.json({ status: "sent", matchCount: matches.length });
}
