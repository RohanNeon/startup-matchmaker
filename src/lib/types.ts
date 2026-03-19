export interface Profile {
  email: string;
  name: string;
  company: string;
  role: string;
  what_building?: string;
  looking_for: string[];
  can_offer: string[];
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
