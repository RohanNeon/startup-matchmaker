export interface Profile {
  id: string;
  name: string;
  company: string;
  role: string;
  what_building: string;
  stage: string;
  looking_for: string[];
  can_offer: string[];
  walk_away_with: string;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
