"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TrendingEvent {
  id: string;
  name: string;
  url: string;
  start_at: string;
  city: string | null;
  host_name: string | null;
  cover_url: string | null;
}

interface RegionData {
  label: string;
  events: TrendingEvent[];
  updated_at: string | null;
}

const LUMA_URLS: Record<string, string> = {
  bangalore: "https://lu.ma/discover?geo=Bengaluru",
  bay_area: "https://lu.ma/discover?geo=San+Francisco",
  singapore: "https://lu.ma/discover?geo=Singapore",
};

export default function TrendingPage() {
  const [regions, setRegions] = useState<Record<string, RegionData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  async function fetchTrending() {
    try {
      const res = await fetch("/api/trending-events");
      const data = await res.json();
      setRegions(data.regions || {});
    } catch {
      // Silently fail
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-[#1d3d0f]/30 border-t-[#1d3d0f] rounded-full animate-spin" />
      </div>
    );
  }

  const regionIds = Object.keys(regions);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Trending Events</h1>
          <p className="text-sm text-[#1d3d0f]/50 mt-1">Upcoming AI, VC & startup events from Luma</p>
        </div>
        <Link href="/admin" className="text-xs text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors">
          ← Home
        </Link>
      </div>

      {/* Stacked regions with horizontal scroll cards */}
      <div className="space-y-10">
        {regionIds.map((regionId) => {
          const region = regions[regionId];
          if (!region) return null;

          return (
            <section key={regionId}>
              {/* Region header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-[#000000]">{region.label}</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1d3d0f]/5 text-[#1d3d0f]/50 font-medium">
                    {region.events.length} events
                  </span>
                </div>
                <a
                  href={LUMA_URLS[regionId] || "https://lu.ma/discover"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors"
                >
                  View all on Luma →
                </a>
              </div>

              {/* Horizontal scroll */}
              {region.events.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                  {region.events.map((event) => {
                    const date = new Date(event.start_at);
                    const dayStr = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                    const timeStr = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

                    return (
                      <a
                        key={event.id}
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-56 rounded-xl border border-[#1d3d0f]/8 bg-white overflow-hidden hover:border-[#1d3d0f]/20 hover:shadow-md transition-all group"
                      >
                        {/* Cover */}
                        <div className="w-full h-32 overflow-hidden bg-[#1d3d0f]/5">
                          {event.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={event.cover_url}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#fdfff0] to-[#e8ff79]/20 flex items-center justify-center">
                              <svg className="w-8 h-8 text-[#1d3d0f]/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-3">
                          <p className="text-[13px] font-semibold text-[#1d3d0f] leading-snug line-clamp-2 group-hover:text-[#000000] min-h-[2.5rem]">
                            {event.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <svg className="w-3 h-3 text-[#1d3d0f]/35 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[11px] text-[#1d3d0f]/55">{dayStr}, {timeStr}</span>
                          </div>
                          {event.host_name && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <svg className="w-3 h-3 text-[#1d3d0f]/35 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                              </svg>
                              <span className="text-[11px] text-[#1d3d0f]/50 truncate">{event.host_name}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8">
                  <p className="text-xs text-[#1d3d0f]/40">No trending events in {region.label}</p>
                </div>
              )}

              {/* Updated timestamp */}
              {region.updated_at && (
                <p className="text-[9px] text-[#1d3d0f]/30 mt-2">
                  Updated {new Date(region.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
