// health_agent.ts
import fetch from "node-fetch";

export type Message = { role: "system" | "user" | "assistant"; content: string };

// Use gpt-3.5-turbo via Responses API
export async function chat(history: Message[]) {
  // set a system prompt for tone
  const system: Message = {
    role: "system",
    content: "You are HopeCoach: a warm, concise wellbeing coach. Be supportive, practical, and non-judgmental."
  };
  const messages = [system, ...history];
  const input = messages.map(m => `${m.role}: ${m.content}`).join("\n\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      input,
      max_output_tokens: 500
    })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Provider error: ${r.status} ${text}`);
  }

  const data = await r.json();
  const output =
    data?.output_text ??
    data?.output?.[0]?.content?.[0]?.text ??
    "Sorry, I couldn't generate a response.";
  return { role: "assistant" as const, content: output };
}

// alias for older calls
export const respond = chat;
