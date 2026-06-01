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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Trending Events</h1>
          <p className="text-sm text-[#1d3d0f]/50 mt-1">Upcoming AI, VC & startup events from Luma</p>
        </div>
        <Link href="/admin" className="text-xs text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors">
          ← Home
        </Link>
      </div>

      {/* 3-column grid — one per region */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {regionIds.map((regionId) => {
          const region = regions[regionId];
          if (!region) return null;

          return (
            <div key={regionId} className="bg-white rounded-xl border border-[#1d3d0f]/8 overflow-hidden">
              {/* Region header */}
              <div className="px-4 py-3 bg-[#fdfff0] border-b border-[#1d3d0f]/6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1d3d0f]">{region.label}</h3>
                <span className="text-[10px] text-[#1d3d0f]/40">{region.events.length} events</span>
              </div>

              {/* Event list */}
              {region.events.length > 0 ? (
                <div className="divide-y divide-[#1d3d0f]/5">
                  {region.events.map((event) => {
                    const date = new Date(event.start_at);
                    const dayStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                    const timeStr = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

                    return (
                      <a
                        key={event.id}
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3 p-3 hover:bg-[#e8ff79]/10 transition-colors group"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#1d3d0f]/5 border border-[#1d3d0f]/6">
                          {event.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={event.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#1d3d0f]/5 to-[#e8ff79]/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-[#1d3d0f]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <p className="text-[12px] font-semibold text-[#1d3d0f] leading-snug line-clamp-2 group-hover:text-[#000000]">
                            {event.name}
                          </p>
                          <p className="text-[10px] text-[#1d3d0f]/50 mt-1.5 truncate">
                            {dayStr}, {timeStr}
                          </p>
                          {event.host_name && (
                            <p className="text-[10px] text-[#1d3d0f]/40 truncate">{event.host_name}</p>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs text-[#1d3d0f]/40">No trending events</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1d3d0f]/5 bg-[#fdfff0]">
                {region.updated_at && (
                  <span className="text-[8px] text-[#1d3d0f]/35">
                    Updated {new Date(region.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                )}
                <a
                  href={LUMA_URLS[regionId] || "https://lu.ma/discover"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors"
                >
                  View all on Luma
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
