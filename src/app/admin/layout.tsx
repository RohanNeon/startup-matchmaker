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
    // Check for existing session
    checkSession();

    // Listen for auth state changes (handles OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const email = session.user.email || "";
          const result = validateAndSetUser(email, session.user.user_metadata);
          if (!result) {
            // Not a neon.fund email — sign them out
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
          hd: ALLOWED_DOMAIN, // Hints Google to show only neon.fund accounts
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <Image
              src="/neon-logo.png"
              alt="Neon Fund"
              width={48}
              height={48}
              className="mx-auto mb-3"
            />
            <h1 className="text-2xl font-bold text-neon-dark">Admin</h1>
            <p className="text-sm text-neon-dark/50 mt-1">Neon Fund Dashboard</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-neon-dark/10 p-6 space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-neon-dark/15 rounded-xl text-sm font-medium text-neon-dark hover:bg-neon-bg transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-xs text-center text-neon-dark/40">
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
      <div className="min-h-screen">
        <header className="bg-white border-b border-neon-dark/10 px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/neon-logo.png" alt="Neon Fund" width={28} height={28} />
              <span className="font-semibold text-neon-dark text-sm">Neon Fund</span>
              <span className="text-neon-dark/30 mx-1">/</span>
              <span className="text-neon-dark/60 text-sm">Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-xs text-neon-dark/60">{user.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    user.role === "super_admin"
                      ? "bg-neon text-neon-dark"
                      : "bg-neon-dark/5 text-neon-dark/50"
                  }`}
                >
                  {user.role === "super_admin" ? "Admin" : "Viewer"}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs text-neon-dark/40 hover:text-neon-dark/70 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
