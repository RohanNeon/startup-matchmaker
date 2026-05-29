"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const SUPER_ADMIN_EMAILS = ["rohan@neon.fund"];
const ALLOWED_DOMAIN = "neon.fund";

export type AdminRole = "super_admin" | "viewer";

interface AdminUser {
  email: string;
  name: string;
  avatar: string | null;
  role: AdminRole;
}

// Context to share admin role with child pages
import { createContext, useContext } from "react";

const AdminContext = createContext<AdminUser | null>(null);
export function useAdminUser() {
  return useContext(AdminContext);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const email = session.user.email || "";
          const result = validateAndSetUser(email, session.user.user_metadata);
          if (!result) {
            await supabase.auth.signOut();
            setError("Access restricted to @neon.fund accounts only.");
            setLoading(false);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const email = session.user.email || "";
      const result = validateAndSetUser(email, session.user.user_metadata);
      if (!result) {
        await supabase.auth.signOut();
        setError("Access restricted to @neon.fund accounts only.");
      }
    }
    setLoading(false);
  }

  function validateAndSetUser(
    email: string,
    metadata: Record<string, unknown> | undefined
  ): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain !== ALLOWED_DOMAIN) {
      return false;
    }

    const role: AdminRole = SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
      ? "super_admin"
      : "viewer";

    setUser({
      email,
      name: (metadata?.full_name as string) || (metadata?.name as string) || email.split("@")[0],
      avatar: (metadata?.avatar_url as string) || null,
      role,
    });
    setError("");
    return true;
  }

  async function handleGoogleLogin() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: {
          hd: ALLOWED_DOMAIN,
        },
      },
    });

    if (authError) {
      setError(authError.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfff0] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#1d3d0f]/30 border-t-[#1d3d0f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdfff0] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <Image
                src="/neon-logo.png"
                alt="Neon Fund"
                width={48}
                height={48}
                className="rounded-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-[#000000] tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-[#1d3d0f]/50 mt-1">
              Sign in to manage events
            </p>
          </div>
          <div className="bg-[#ffffff] rounded-2xl border border-[#1d3d0f]/10 p-6 space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#ffffff] border border-[#1d3d0f]/15 rounded-xl text-sm font-medium text-[#000000] hover:bg-[#fdfff0] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-[11px] text-center text-[#1d3d0f]/35">
              Only @neon.fund accounts can access this dashboard
            </p>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={user}>
      <div className="min-h-screen bg-[#fdfff0]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#1d3d0f]">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/neon-logo.png"
                alt="Neon Fund"
                width={24}
                height={24}
                className="rounded"
              />
              <span className="font-semibold text-[#e8ff79] text-sm">
                Neon Fund
              </span>
              <span className="text-[#ffffff]/20 text-xs">/</span>
              <span className="text-[#ffffff]/60 text-sm">Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-6 h-6 rounded-md"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-[#e8ff79] flex items-center justify-center text-[10px] font-bold text-[#1d3d0f]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-[#ffffff]/60 hidden sm:inline">
                  {user.name}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    user.role === "super_admin"
                      ? "bg-[#e8ff79] text-[#1d3d0f]"
                      : "bg-[#ffffff]/10 text-[#ffffff]/60"
                  }`}
                >
                  {user.role === "super_admin" ? "Admin" : "Viewer"}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs text-[#ffffff]/30 hover:text-[#ffffff]/60 transition-colors ml-1"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-5 sm:px-6 py-8">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
