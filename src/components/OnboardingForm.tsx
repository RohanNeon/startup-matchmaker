"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";

const OPTIONS = ["Investor", "Co-founder", "Customers", "Talent", "Peers"];

interface Props {
  onComplete: (profile: Profile) => void;
}

export default function OnboardingForm({ onComplete }: Props) {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    role: "",
    what_building: "",
    looking_for: [] as string[],
    can_offer: [] as string[],
  });
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleArray(field: "looking_for" | "can_offer", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  }

  // Step 1: Validate form and send OTP
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.email || !form.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.looking_for.length === 0) {
      setError("Please select at least one 'Looking for' option.");
      return;
    }
    if (form.can_offer.length === 0) {
      setError("Please select at least one 'Can offer' option.");
      return;
    }

    setSubmitting(true);

    // Send OTP to email via Supabase Auth
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: form.email.toLowerCase().trim(),
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setStep("otp");
  }

  // Step 2: Verify OTP and save profile
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const email = form.email.toLowerCase().trim();

    // Verify the OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (verifyError) {
      setError("Invalid code. Please try again.");
      setSubmitting(false);
      return;
    }

    // OTP verified — save profile
    const profileData = {
      email,
      name: form.name,
      company: form.company,
      role: form.role,
      what_building: form.what_building || "",
      looking_for: form.looking_for,
      can_offer: form.can_offer,
    };

    const { data, error: dbError } = await supabase
      .from("profiles")
      .insert([profileData])
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
      return;
    }

    localStorage.setItem("profile_email", email);
    onComplete(data as Profile);
  }

  // OTP verification screen
  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <Image
              src="/neon-logo.png"
              alt="Neon Fund"
              width={56}
              height={56}
              className="mx-auto mb-3"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neon-dark">
              Verify Your Email
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-neon-dark/60">
              We sent a verification code to{" "}
              <span className="font-medium text-neon-dark">{form.email}</span>
            </p>
          </div>

          <form
            onSubmit={handleVerifyOtp}
            className="bg-white rounded-2xl shadow-sm border border-neon-dark/10 p-5 sm:p-8 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                Verification code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 8-digit code"
                required
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl border border-neon-dark/15 text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-neon-dark focus:border-transparent placeholder:text-neon-dark/30 bg-white"
              />
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || otp.length < 8}
              className="w-full py-3 px-4 bg-neon-dark text-neon rounded-xl font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("form");
                setOtp("");
                setError("");
              }}
              className="w-full text-sm text-neon-dark/50 hover:text-neon-dark/70 transition-colors"
            >
              ← Back to form
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6 sm:mb-8">
          <Image
            src="/neon-logo.png"
            alt="Neon Fund"
            width={56}
            height={56}
            className="mx-auto mb-3"
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neon-dark">
            Startup Matchmaker
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-neon-dark/60">
            Tell us about yourself so we can find your best matches today.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-neon-dark/10 p-5 sm:p-8 space-y-5 sm:space-y-6"
        >
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            placeholder="you@example.com"
            required
            type="email"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Jane Smith"
              required
            />
            <Field
              label="Company"
              value={form.company}
              onChange={(v) => setForm({ ...form, company: v })}
              placeholder="Acme Inc."
              required
            />
          </div>

          <Field
            label="Role"
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            placeholder="CEO & Co-founder"
            required
          />

          <div>
            <label className="block text-sm font-medium text-neon-dark/80 mb-1">
              What are you building? <span className="text-neon-dark/40 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.what_building}
              onChange={(e) => {
                const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                if (words.length <= 100 || e.target.value.length < form.what_building.length) {
                  setForm({ ...form, what_building: e.target.value });
                }
              }}
              placeholder="An AI-powered platform for..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark focus:border-transparent placeholder:text-neon-dark/30 bg-white resize-none"
            />
            <p className="text-xs text-neon-dark/40 mt-1 text-right">
              {form.what_building.trim().split(/\s+/).filter(Boolean).length}/100 words
            </p>
          </div>

          <MultiSelect
            label="Looking for"
            options={OPTIONS}
            selected={form.looking_for}
            onToggle={(v) => toggleArray("looking_for", v)}
          />

          <MultiSelect
            label="Can offer"
            options={OPTIONS}
            selected={form.can_offer}
            onToggle={(v) => toggleArray("can_offer", v)}
          />

          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-neon-dark text-neon rounded-xl font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {submitting ? "Sending verification..." : "Find My Matches"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neon-dark/80 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2.5 rounded-xl border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark focus:border-transparent placeholder:text-neon-dark/30 bg-white"
      />
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neon-dark/80 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              selected.includes(opt)
                ? "bg-neon-dark text-neon border-neon-dark"
                : "bg-white text-neon-dark/70 border-neon-dark/20 hover:border-neon-dark/40"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
