"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_auth");
    if (saved === "true") {
      setAuthenticated(true);
    }
    setLoading(false);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      sessionStorage.setItem("admin_auth", "true");
      sessionStorage.setItem("admin_password", password);
      setAuthenticated(true);
    } else {
      setError("Invalid password");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
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
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl shadow-sm border border-neon-dark/10 p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark focus:border-transparent bg-white"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full py-2.5 bg-neon-dark text-neon rounded-xl font-semibold hover:bg-neon-dark/90 transition-colors text-sm"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-neon-dark/10 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/neon-logo.png" alt="Neon Fund" width={28} height={28} />
            <span className="font-semibold text-neon-dark text-sm">Neon Fund</span>
            <span className="text-neon-dark/30 mx-1">/</span>
            <span className="text-neon-dark/60 text-sm">Admin</span>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_auth");
              sessionStorage.removeItem("admin_password");
              setAuthenticated(false);
            }}
            className="text-xs text-neon-dark/40 hover:text-neon-dark/70 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
