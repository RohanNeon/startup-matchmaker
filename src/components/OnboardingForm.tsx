"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";

const STAGES = ["Idea", "Pre-revenue", "Revenue", "Scaling"];
const OPTIONS = ["Investor", "Co-founder", "Customers", "Talent", "Peers"];

interface Props {
  onComplete: (profile: Profile) => void;
}

export default function OnboardingForm({ onComplete }: Props) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "",
    what_building: "",
    stage: "",
    looking_for: [] as string[],
    can_offer: [] as string[],
    walk_away_with: "",
  });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.stage) {
      setError("Please select a stage.");
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
    const { data, error: dbError } = await supabase
      .from("profiles")
      .insert([form])
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
      return;
    }

    localStorage.setItem("profile_id", data.id);
    onComplete(data as Profile);
  }

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

          <Field
            label="What are you building?"
            value={form.what_building}
            onChange={(v) => setForm({ ...form, what_building: v })}
            placeholder="An AI-powered platform for..."
            required
          />

          <div>
            <label className="block text-sm font-medium text-neon-dark/80 mb-2">
              Stage
            </label>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, stage: s })}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    form.stage === s
                      ? "bg-neon-dark text-neon border-neon-dark"
                      : "bg-white text-neon-dark/70 border-neon-dark/20 hover:border-neon-dark/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
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

          <Field
            label="One thing you want to walk away with today"
            value={form.walk_away_with}
            onChange={(v) => setForm({ ...form, walk_away_with: v })}
            placeholder="A warm intro to a Series A investor"
            required
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
            {submitting ? "Saving..." : "Find My Matches"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neon-dark/80 mb-1">
        {label}
      </label>
      <input
        type="text"
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
