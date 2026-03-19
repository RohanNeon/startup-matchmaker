"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";
import OnboardingForm from "@/components/OnboardingForm";
import WaitingScreen from "@/components/WaitingScreen";

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkExistingProfile() {
      const savedEmail = localStorage.getItem("profile_email");
      if (savedEmail) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", savedEmail)
          .single();

        if (data) {
          setProfile(data as Profile);
        } else {
          localStorage.removeItem("profile_email");
        }
      }
      setLoading(false);
    }

    checkExistingProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <OnboardingForm onComplete={setProfile} />;
  }

  return <WaitingScreen profile={profile} />;
}
