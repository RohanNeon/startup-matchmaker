import { createClient } from "@supabase/supabase-js";

// Hardcoded fallback — always have access even if DB table doesn't exist yet
const SUPER_ADMIN_EMAILS = ["rohan@neon.fund", "nansi@neon.fund", "shikhar@neon.fund"];
const ALLOWED_DOMAIN = "neon.fund";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check if an email is a super admin.
 * Checks hardcoded list first, then falls back to `admins` table in Supabase.
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const lower = email.toLowerCase();

  // Hardcoded list always works
  if (SUPER_ADMIN_EMAILS.includes(lower)) return true;

  // Check dynamic admins table
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("admins")
      .select("email")
      .eq("email", lower)
      .single();
    return !!data;
  } catch {
    // Table might not exist yet — that's fine
    return false;
  }
}

/**
 * Verify the request is from an authenticated super admin.
 * Expects Authorization: Bearer <supabase_access_token> header.
 * Checks both hardcoded list and `admins` table.
 */
export async function verifySuperAdmin(request: Request): Promise<
  | { authorized: true; email: string }
  | { authorized: false; error: string; status: number }
> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, error: "Missing authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAdmin = getSupabaseAdmin();

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || !user.email) {
    return { authorized: false, error: "Invalid or expired token", status: 401 };
  }

  const domain = user.email.split("@")[1]?.toLowerCase();
  if (domain !== ALLOWED_DOMAIN) {
    return { authorized: false, error: "Access restricted to @neon.fund accounts", status: 403 };
  }

  const admin = await isAdminEmail(user.email);
  if (!admin) {
    return { authorized: false, error: "Super admin access required", status: 403 };
  }

  return { authorized: true, email: user.email };
}
