import { createClient } from "@supabase/supabase-js";

const SUPER_ADMIN_EMAILS = ["rohan@neon.fund"];
const ALLOWED_DOMAIN = "neon.fund";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify the request is from an authenticated super admin.
 * Expects Authorization: Bearer <supabase_access_token> header.
 * Returns { authorized: true, email } or { authorized: false, error, status }.
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

  if (!SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return { authorized: false, error: "Super admin access required", status: 403 };
  }

  return { authorized: true, email: user.email };
}
