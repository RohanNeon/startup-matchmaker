"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "../layout";

interface AdminEntry {
  email: string;
  added_by: string | null;
  created_at: string;
}

const CORE_ADMINS = ["rohan@neon.fund", "nansi@neon.fund"];

export default function SettingsPage() {
  const adminUser = useAdminUser();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [loading, setLoading] = useState(true);

  // Redirect non-admins
  useEffect(() => {
    if (adminUser && adminUser.role !== "super_admin") {
      router.push("/admin");
    }
  }, [adminUser, router]);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  }

  async function loadAdmins() {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admins", { headers });
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins || []);
    }
    setLoading(false);
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    setAdminError("");

    const headers = await getAuthHeaders();
    const res = await fetch("/api/admins", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: newAdminEmail.trim() }),
    });

    const data = await res.json();
    if (res.ok) {
      setNewAdminEmail("");
      await loadAdmins();
    } else {
      setAdminError(data.error || "Failed to add admin");
    }
    setAddingAdmin(false);
  }

  async function handleRemoveAdmin(email: string) {
    const confirmed = window.confirm(`Remove ${email} as admin?`);
    if (!confirmed) return;

    const headers = await getAuthHeaders();
    const res = await fetch("/api/admins", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      await loadAdmins();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to remove admin");
    }
  }

  if (!adminUser || adminUser.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-[#1d3d0f]/30 border-t-[#1d3d0f] rounded-full animate-spin" />
      </div>
    );
  }

  // Merge core + dynamic admins into one list
  const allAdmins = [
    ...CORE_ADMINS.map((email) => ({
      email,
      added_by: null as string | null,
      created_at: "",
      isCore: true,
    })),
    ...admins
      .filter((a) => !CORE_ADMINS.includes(a.email.toLowerCase()))
      .map((a) => ({ ...a, isCore: false })),
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#000000] tracking-tight mb-1">
        Settings
      </h1>
      <p className="text-sm text-[#1d3d0f]/40 mb-8">
        Manage admins and platform settings
      </p>

      {/* Admin Management */}
      <section className="mb-10">
        <h2 className="text-sm font-bold text-[#000000] mb-4">
          Admin Access
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 border-2 border-[#1d3d0f]/30 border-t-[#1d3d0f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {allAdmins.map((admin) => (
              <div
                key={admin.email}
                className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#fdfff0] border border-[#1d3d0f]/8"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      admin.isCore
                        ? "bg-[#1d3d0f] text-[#e8ff79]"
                        : "bg-[#e8ff79] text-[#1d3d0f]"
                    }`}
                  >
                    {admin.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#000000]">
                      {admin.email}
                    </p>
                    {admin.isCore ? (
                      <p className="text-[10px] text-[#1d3d0f]/35">
                        Core admin
                      </p>
                    ) : admin.added_by ? (
                      <p className="text-[10px] text-[#1d3d0f]/35">
                        Added by {admin.added_by.split("@")[0]}
                        {admin.created_at && (
                          <>
                            {" · "}
                            {new Date(admin.created_at).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </>
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                {admin.isCore ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1d3d0f]/8 text-[#1d3d0f]/40 font-medium">
                    Permanent
                  </span>
                ) : (
                  <button
                    onClick={() => handleRemoveAdmin(admin.email)}
                    className="text-[11px] text-[#1d3d0f]/25 hover:text-red-500 transition-colors font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add admin form */}
        <form
          onSubmit={handleAddAdmin}
          className="mt-4 flex gap-2"
        >
          <input
            type="email"
            value={newAdminEmail}
            onChange={(e) => {
              setNewAdminEmail(e.target.value);
              setAdminError("");
            }}
            placeholder="name@neon.fund"
            className="flex-1 px-3 py-2.5 rounded-xl border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
          />
          <button
            type="submit"
            disabled={addingAdmin || !newAdminEmail.trim()}
            className="px-5 py-2.5 bg-[#1d3d0f] text-[#e8ff79] rounded-xl text-sm font-semibold hover:bg-[#000000] transition-colors disabled:opacity-30"
          >
            {addingAdmin ? "Adding..." : "Add Admin"}
          </button>
        </form>
        {adminError && (
          <p className="text-xs text-red-600 mt-2">{adminError}</p>
        )}
        <p className="text-[11px] text-[#1d3d0f]/25 mt-2">
          Only @neon.fund emails can be added. Admins can create events, run MatchUp, and send emails.
        </p>
      </section>

      {/* Info card */}
      <section>
        <h2 className="text-sm font-bold text-[#000000] mb-4">
          Roles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#1d3d0f]/8 p-4 bg-[#fdfff0]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#e8ff79] text-[#1d3d0f]">
                Admin
              </span>
            </div>
            <ul className="space-y-1">
              {[
                "Create & delete events",
                "Upload guest lists",
                "Run MatchUp algorithm",
                "Send match emails",
                "Manage admins",
              ].map((item) => (
                <li
                  key={item}
                  className="text-xs text-[#1d3d0f]/60 flex items-center gap-1.5"
                >
                  <span className="text-[#1d3d0f]/25">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#1d3d0f]/8 p-4 bg-[#fdfff0]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#000000]/5 text-[#000000]/30">
                Viewer
              </span>
            </div>
            <ul className="space-y-1">
              {[
                "View dashboard metrics",
                "Browse event details",
                "See participant lists",
                "View match results",
                "Read-only access",
              ].map((item) => (
                <li
                  key={item}
                  className="text-xs text-[#1d3d0f]/60 flex items-center gap-1.5"
                >
                  <span className="text-[#1d3d0f]/25">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-[11px] text-[#1d3d0f]/25 mt-3">
          Any @neon.fund Google account can sign in as a viewer. Only admins can modify data.
        </p>
      </section>
    </div>
  );
}
