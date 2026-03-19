"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChatMessage, Profile } from "@/lib/types";

interface Props {
  profile: Profile;
}

const SUGGESTION_CHIPS = [
  "Who should I meet?",
  "Any investors here?",
  "Who's building something similar to me?",
  "Find my top 3 matches",
  "Who can help me with funding?",
];

export default function ChatInterface({ profile }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [chipsUsed, setChipsUsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!greeted) {
      setGreeted(true);
      sendMessage("", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string, isGreeting = false) {
    const newMessages: ChatMessage[] = isGreeting
      ? []
      : [...messages, { role: "user" as const, content: text }];

    if (!isGreeting) {
      setMessages(newMessages);
      setInput("");
    }

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileEmail: profile.email,
          messages: newMessages,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = await res.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.message },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleChipClick(text: string) {
    if (loading) return;
    setChipsUsed(true);
    sendMessage(text);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setChipsUsed(true);
    sendMessage(input.trim());
  }

  return (
    <div className="h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b border-neon-dark/10 bg-white px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/neon-logo.png"
              alt="Neon Fund"
              width={32}
              height={32}
              className="shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-neon-dark truncate">
                Startup Matchmaker
              </h1>
              <p className="text-xs sm:text-sm text-neon-dark/50 hidden sm:block">
                Ask me who you should meet today
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-neon-dark">{profile.name}</p>
            <p className="text-xs text-neon-dark/50 hidden sm:block">
              {profile.role} @ {profile.company}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-neon-dark text-neon"
                    : "bg-white border border-neon-dark/10 text-neon-dark"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* Suggestion chips — show after greeting, hide once user sends a message */}
          {!chipsUsed && messages.length > 0 && !loading && (
            <div className="flex flex-wrap gap-2 justify-center py-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="px-3.5 py-2 rounded-full border border-neon-dark/15 bg-white text-xs sm:text-sm text-neon-dark/70 hover:bg-neon hover:text-neon-dark hover:border-neon-dark/20 transition-all duration-200 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-neon-dark/10 rounded-2xl px-5 py-3">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-neon-dark/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-neon-dark/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-neon-dark/30 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neon-dark/10 bg-white px-3 sm:px-4 py-3 sm:py-4 shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-2 sm:gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Who should I meet?"
            disabled={loading}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark focus:border-transparent placeholder:text-neon-dark/30 disabled:opacity-50 bg-white"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
