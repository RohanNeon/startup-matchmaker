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
    const { profileId, messages } = (await req.json()) as {
      profileId: string;
      messages: ChatMessage[];
    };

    // Fetch current user's profile
    const { data: currentUser } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
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
      .neq("id", profileId);

    const otherProfiles = (allProfiles || []) as Profile[];

    const systemPrompt = `You are a matchmaking assistant for a startup networking event with about 50 attendees. Your job is to help attendees find the best people to connect with at the event.

## Current user
${formatProfile(currentUser as Profile)}

## Other attendees at the event
${otherProfiles.length > 0 ? otherProfiles.map(formatProfile).join("\n\n") : "No other attendees have registered yet."}

## Instructions
- Greet the user warmly by their first name on your first message. Briefly mention what you know about them and offer to help find matches.
- When asked who to meet, suggest specific people by name with clear reasoning based on mutual interests, complementary needs (e.g., someone looking for investors matched with someone who can offer investment), or shared domains.
- Be concise and actionable. Use the attendee data to give specific, personalized recommendations.
- If no attendees match a query, say so honestly and suggest what to look for.
- Keep a warm, professional tone appropriate for a startup networking event.`;

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
      max_tokens: 1024,
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
