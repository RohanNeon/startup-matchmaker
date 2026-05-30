import { NextResponse } from "next/server";
import { getSupabaseAdmin, verifySuperAdmin } from "@/lib/admin-auth";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");

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

// POST /api/admins/send-otp — send verification code to the email being added
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { email } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain !== "neon.fund") {
    return NextResponse.json(
      { error: "Only @neon.fund emails can be added as admin" },
      { status: 400 }
    );
  }

  // Generate 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const supabaseAdmin = getSupabaseAdmin();

  // Store OTP (upsert — replaces any existing code for this email)
  const { error: dbError } = await supabaseAdmin
    .from("admin_otps")
    .upsert([{
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt.toISOString(),
      requested_by: auth.email,
    }]);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Send OTP email
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: '"Neon Fund" <rohan@neon.fund>',
      to: email.toLowerCase(),
      subject: "Admin Access Verification — Neon Fund",
      html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #fdfff0; font-family: 'Inter', -apple-system, sans-serif;">
  <div style="max-width: 440px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://neon-matchmaker.vercel.app/neon-logo-email.png" alt="Neon Fund" width="40" height="40" style="border-radius: 8px;" />
    </div>
    <div style="background: #ffffff; border-radius: 16px; padding: 32px 24px; border: 1px solid rgba(29,61,15,0.1); text-align: center;">
      <p style="color: #1d3d0f; font-size: 15px; margin: 0 0 4px; font-weight: 600;">Admin Access Request</p>
      <p style="color: #1d3d0f99; font-size: 13px; margin: 0 0 24px; line-height: 1.5;">
        ${auth.email.split("@")[0]} is adding you as an admin on the Neon Fund Event Dashboard. Share this code with them to confirm.
      </p>
      <div style="background: #1d3d0f; border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 200px;">
        <span style="color: #e8ff79; font-size: 32px; font-weight: 700; letter-spacing: 6px; font-family: monospace;">
          ${code}
        </span>
      </div>
      <p style="color: #1d3d0f50; font-size: 11px; margin: 16px 0 0;">
        Expires in 10 minutes. If you didn't expect this, ignore it.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send OTP: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ sent: true, email: email.toLowerCase() });
}
