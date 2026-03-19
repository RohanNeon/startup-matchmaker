import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { Profile, ChatMessage } from "@/lib/types";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatProfile(p: Profile): string {
  return [
    `- ${p.name} (${p.role} @ ${p.company})`,
    `  Building: ${p.what_building}`,
    `  Stage: ${p.stage}`,
    `  Looking for: ${p.looking_for.join(", ")}`,
    `  Can offer: ${p.can_offer.join(", ")}`,
    `  Wants to walk away with: ${p.walk_away_with}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { profileEmail, messages } = (await req.json()) as {
      profileEmail: string;
      messages: ChatMessage[];
    };

    // Fetch current user's profile
    const { data: currentUser } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", profileEmail)
      .single();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Fetch all other profiles
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("*")
      .neq("email", profileEmail);

    const otherProfiles = (allProfiles || []) as Profile[];

    const systemPrompt = `You are a matchmaking assistant for a startup networking event with about 50 attendees. Your job is to help attendees find the best people to connect with at the event.

## Current user
${formatProfile(currentUser as Profile)}

## Other attendees at the event
${otherProfiles.length > 0 ? otherProfiles.map(formatProfile).join("\n\n") : "No other attendees have registered yet."}

## Instructions
- Keep responses SHORT — 2-4 sentences max per recommendation. No fluff.
- Greet briefly by first name on first message. One line about them, then ask how you can help.
- When suggesting people, use this format: **Name** (Role @ Company) — one line on why they're a match.
- Max 3 recommendations per response unless asked for more.
- No long intros, no filler, no "Great question!". Just the matches and why.
- If no one matches, say so in one sentence.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        // If no user messages yet, this is the greeting
        ...(messages.length === 0
          ? [{ role: "user" as const, content: "Hi! I just arrived at the event." }]
          : []),
      ],
      temperature: 0.7,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
