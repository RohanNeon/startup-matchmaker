"use client";

import Image from "next/image";
import { Profile } from "@/lib/types";

interface Props {
  profile: Profile;
}

export default function WaitingScreen({ profile }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md text-center">
        <Image
          src="/neon-logo.png"
          alt="Neon Fund"
          width={56}
          height={56}
          className="mx-auto mb-4"
        />

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neon-dark mb-3">
          You&apos;re all set, {profile.name.split(" ")[0]}!
        </h1>

        <div className="bg-white rounded-2xl shadow-sm border border-neon-dark/10 p-6 sm:p-8 mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neon/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-neon-dark"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <p className="text-neon-dark/80 text-sm sm:text-base leading-relaxed mb-4">
            We&apos;ll send your best matches to{" "}
            <span className="font-medium text-neon-dark">{profile.email}</span>{" "}
            before the networking session starts.
          </p>

          <p className="text-neon-dark/50 text-sm">
            Sit tight — great connections are on the way!
          </p>
        </div>

        <div className="bg-neon/20 rounded-xl p-4 border border-neon-dark/10">
          <p className="text-xs text-neon-dark/60">
            Your profile has been saved. You can close this page — we&apos;ll email your matches.
          </p>
        </div>
      </div>
    </div>
  );
}
