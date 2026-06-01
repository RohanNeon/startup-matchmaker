"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface CalendarEvent {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  is_active: boolean;
  image_url: string | null;
  guestCount: number;
  profileCount: number;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data } = await supabase.from("events").select("id, slug, name, event_date, location, is_active, image_url").order("event_date", { ascending: true });
    if (data) {
      const evts: CalendarEvent[] = [];
      for (const ev of data) {
        const isLegacy = ev.slug === "agentic-infra-2026";
        const [{ count: g }, { count: p }] = await Promise.all([
          isLegacy
            ? supabase.from("luma_list").select("*", { count: "exact", head: true }).is("event_id", null)
            : supabase.from("luma_list").select("*", { count: "exact", head: true }).eq("event_id", ev.id),
          isLegacy
            ? supabase.from("profiles").select("*", { count: "exact", head: true }).is("event_id", null)
            : supabase.from("profiles").select("*", { count: "exact", head: true }).eq("event_id", ev.id),
        ]);
        evts.push({ ...ev, guestCount: g || 0, profileCount: p || 0 });
      }
      setEvents(evts);
    }
    setLoading(false);
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const pad = (n: number) => String(n).padStart(2, "0");
  const getKey = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  const eventMap = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    if (!ev.event_date) continue;
    const key = ev.event_date.slice(0, 10);
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push(ev);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Events this month
  const monthEvents = events.filter((ev) => {
    if (!ev.event_date) return false;
    const d = new Date(ev.event_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Upcoming events (future)
  const upcomingEvents = events.filter((ev) => {
    if (!ev.event_date) return false;
    return new Date(ev.event_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  // Past events
  const pastEvents = events.filter((ev) => {
    if (!ev.event_date) return false;
    return new Date(ev.event_date) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Image src="/neon-logo.png" alt="Loading" width={36} height={36} className="animate-logo-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Calendar</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#1d3d0f]/8 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#000000]">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-md hover:bg-[#1d3d0f]/5 text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="text-xs px-2.5 py-1 rounded-md text-[#1d3d0f]/60 hover:text-[#1d3d0f] hover:bg-[#1d3d0f]/5 transition-colors">Today</button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-md hover:bg-[#1d3d0f]/5 text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-[#1d3d0f]/40 py-2">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const key = getKey(day);
              const dayEvents = eventMap.get(key) || [];
              const hasEvent = dayEvents.length > 0;
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

              return (
                <div
                  key={key}
                  className={`min-h-[72px] p-1.5 rounded-lg border transition-colors ${
                    hasEvent
                      ? "bg-[#1d3d0f] border-[#1d3d0f]"
                      : isToday
                        ? "bg-[#e8ff79]/20 border-[#e8ff79]/50"
                        : "border-transparent hover:bg-[#fdfff0]"
                  }`}
                >
                  <span className={`text-xs font-medium block ${
                    hasEvent ? "text-[#e8ff79]" : isToday ? "text-[#1d3d0f] font-bold" : "text-[#1d3d0f]/50"
                  }`}>
                    {day}
                  </span>
                  {dayEvents.map((ev) => (
                    <Link key={ev.id} href={`/admin/event/${ev.slug}`} className="block mt-0.5">
                      <span className={`text-[9px] leading-tight block truncate ${hasEvent ? "text-[#e8ff79]/70 hover:text-white" : "text-[#1d3d0f]/60"}`}>
                        {ev.name}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — upcoming + past */}
        <div className="space-y-6">
          {/* Upcoming events */}
          <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
            <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">Upcoming Events</h3>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((ev) => (
                  <Link key={ev.id} href={`/admin/event/${ev.slug}`} className="flex gap-3 group">
                    {ev.image_url && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#1d3d0f]/8 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ev.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1d3d0f] group-hover:text-[#000000] truncate">{ev.name}</p>
                      <p className="text-[10px] text-[#1d3d0f]/50 mt-0.5">
                        {ev.event_date ? new Date(ev.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                      <p className="text-[10px] text-[#1d3d0f]/40 mt-0.5">{ev.profileCount} registered of {ev.guestCount} guests</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#1d3d0f]/50 italic">No upcoming events</p>
            )}
          </div>

          {/* Past events */}
          {pastEvents.length > 0 && (
            <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
              <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">Past Events</h3>
              <div className="space-y-2.5">
                {pastEvents.map((ev) => (
                  <Link key={ev.id} href={`/admin/event/${ev.slug}`} className="flex items-center justify-between group py-1">
                    <div className="min-w-0 mr-3">
                      <p className="text-xs font-medium text-[#1d3d0f]/70 group-hover:text-[#1d3d0f] truncate">{ev.name}</p>
                      <p className="text-[10px] text-[#1d3d0f]/40">
                        {ev.event_date ? new Date(ev.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#1d3d0f]/40 flex-shrink-0">{ev.profileCount} reg.</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* This month */}
          {monthEvents.length > 0 && (
            <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
              <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-3">
                This Month ({monthEvents.length})
              </h3>
              <div className="space-y-2">
                {monthEvents.map((ev) => (
                  <Link key={ev.id} href={`/admin/event/${ev.slug}`} className="flex items-center gap-2 group">
                    <span className="w-2 h-2 rounded-full bg-[#1d3d0f] flex-shrink-0" />
                    <span className="text-xs text-[#1d3d0f] group-hover:underline truncate">{ev.name}</span>
                    {ev.is_active && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#e8ff79] text-[#1d3d0f] font-semibold flex-shrink-0">Active</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
