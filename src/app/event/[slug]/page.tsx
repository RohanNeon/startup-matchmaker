"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";
import EventOnboardingForm from "@/components/EventOnboardingForm";
import WaitingScreen from "@/components/WaitingScreen";

interface EventData {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  is_active: boolean;
}

export default function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvent() {
      // Fetch event by slug
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, slug, name, event_date, location, is_active")
        .eq("slug", slug)
        .single();

      if (eventError || !eventData) {
        setError("Event not found.");
        setLoading(false);
        return;
      }

      if (!eventData.is_active) {
        setError("This event is no longer accepting registrations.");
        setLoading(false);
        return;
      }

      setEvent(eventData as EventData);

      // Check if user already registered for this event
      const savedEmail = localStorage.getItem(`profile_email_${eventData.id}`);
      if (savedEmail) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", savedEmail)
          .eq("event_id", eventData.id)
          .single();

        if (profileData) {
          setProfile(profileData as Profile);
        } else {
          localStorage.removeItem(`profile_email_${eventData.id}`);
        }
      }

      setLoading(false);
    }

    loadEvent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neon-dark mb-2">Oops</h1>
          <p className="text-neon-dark/60">{error}</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  if (profile) {
    return <WaitingScreen profile={profile} />;
  }

  return (
    <EventOnboardingForm
      eventId={event.id}
      eventName={event.name}
      onComplete={setProfile}
    />
  );
}
