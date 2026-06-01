"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SUPER_ADMIN_EMAILS = ["rohan@neon.fund", "nansi@neon.fund", "shikhar@neon.fund"];
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
          const result = await validateAndSetUser(email, session.user.user_metadata);
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
      const result = await validateAndSetUser(email, session.user.user_metadata);
      if (!result) {
        await supabase.auth.signOut();
        setError("Access restricted to @neon.fund accounts only.");
      }
    }
    setLoading(false);
  }

  async function validateAndSetUser(
    email: string,
    metadata: Record<string, unknown> | undefined
  ): Promise<boolean> {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain !== ALLOWED_DOMAIN) {
      return false;
    }

    // Check hardcoded list first
    let role: AdminRole = SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
      ? "super_admin"
      : "viewer";

    // If not in hardcoded list, check dynamic admins table
    if (role === "viewer") {
      try {
        const { data } = await supabase
          .from("admins")
          .select("email")
          .eq("email", email.toLowerCase())
          .single();
        if (data) role = "super_admin";
      } catch {
        // Table might not exist yet
      }
    }

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
      <div className="min-h-screen bg-[#ffffff] flex flex-col items-center justify-center gap-4">
        <Image src="/neon-logo.png" alt="Loading" width={44} height={44} className="animate-logo-pulse rounded-lg" />
        <p className="text-[11px] text-[#1d3d0f]/30 font-medium tracking-wider uppercase">Loading</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center px-4">
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
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#ffffff] border border-[#1d3d0f]/15 rounded-xl text-sm font-medium text-[#000000] hover:bg-[#ffffff] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-[11px] text-center text-[#1d3d0f]/50">
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

  const pathname = usePathname();
  const isSettings = pathname === "/admin/settings";
  const isEventPage = pathname.startsWith("/admin/event/");

  const navItems = [
    { href: "/admin", label: "Home", match: (p: string) => p === "/admin" },
    { href: "/admin/dashboard", label: "Dashboard", match: (p: string) => p === "/admin/dashboard" },
    { href: "/admin/events", label: "Events", match: (p: string) => p === "/admin/events" },
    { href: "/admin/calendar", label: "Calendar", match: (p: string) => p === "/admin/calendar" },
    { href: "/admin/trending", label: "Trending", match: (p: string) => p === "/admin/trending" },
  ];

  return (
    <AdminContext.Provider value={user}>
      <div className="min-h-screen bg-[#ffffff]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#1d3d0f]">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
            {/* ── Left: Logo + Nav ── */}
            <div className="flex items-center gap-1.5">
              <Link href="/admin" className="flex items-center gap-2.5 mr-2">
                <Image
                  src="/neon-logo.png"
                  alt="Neon Fund"
                  width={24}
                  height={24}
                  className="rounded"
                />
                <span className="font-semibold text-[#e8ff79] text-sm hidden sm:inline">
                  Neon Fund
                </span>
              </Link>
              <span className="text-[#ffffff]/15 text-xs hidden sm:inline">/</span>
              {navItems.map((item) => {
                const isActive = item.match(pathname) || (isEventPage && item.href === "/admin/events");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-[12px] px-2 py-1 rounded-md transition-colors ${
                      isActive
                        ? "text-[#ffffff] bg-[#ffffff]/10"
                        : "text-[#ffffff]/40 hover:text-[#ffffff]/80 hover:bg-[#ffffff]/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* ── Right: Luma + Settings + Profile ── */}
            <div className="flex items-center gap-1">
              {/* Luma — create event */}
              <a
                href="https://lu.ma/create"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#ffffff]/50 hover:text-[#ffffff]/90 transition-colors px-2.5 py-1.5 rounded-md hover:bg-[#ffffff]/5"
                title="Create event on Luma"
              >
                <Image
                  src="/luma-logo.png"
                  alt="Luma"
                  width={14}
                  height={14}
                  className="brightness-200"
                />
                <span className="hidden sm:inline">+ Create on Luma</span>
              </a>

              {/* Settings — admin only */}
              {user.role === "super_admin" && (
                <Link
                  href="/admin/settings"
                  className={`p-2 rounded-md transition-colors ${
                    isSettings
                      ? "text-[#ffffff] bg-[#ffffff]/10"
                      : "text-[#ffffff]/35 hover:text-[#ffffff]/70 hover:bg-[#ffffff]/5"
                  }`}
                  title="Settings"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              )}

              <span className="w-px h-5 bg-[#ffffff]/10 mx-1.5" />

              {/* Profile */}
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#e8ff79] flex items-center justify-center text-[10px] font-bold text-[#1d3d0f]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-[#ffffff]/60 hidden sm:inline">
                  {user.name}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    user.role === "super_admin"
                      ? "bg-[#e8ff79]/20 text-[#e8ff79]"
                      : "bg-[#ffffff]/10 text-[#ffffff]/50"
                  }`}
                >
                  {user.role === "super_admin" ? "Admin" : "Viewer"}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="text-xs text-[#ffffff]/25 hover:text-[#ffffff]/60 transition-colors ml-2 p-1.5 rounded-md hover:bg-[#ffffff]/5"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
