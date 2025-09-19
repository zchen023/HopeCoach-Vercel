// health_agent.ts
// Using gpt-3.5-turbo with the Responses API (plain text, no response_format)

import fetch from "node-fetch";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function respond(history: Message[]) {
  // Optional system prompt to keep tone on-brand
  const system: Message = {
    role: "system",
    content:
      "You are HopeCoach: a warm, concise wellbeing coach. Be supportive, practical, and non-judgmental."
  };

  const messages = [system, ...history];

  // Build a simple plain-text input for the Responses API
  const input = messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",      // 👈 switched here
      input,
      max_output_tokens: 500
    })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Provider error: ${r.status} ${text}`);
  }

  const data = await r.json();

  // The Responses API exposes a unified text field
  const output =
    data?.output_text ??
    data?.output?.[0]?.content?.[0]?.text ??
    "Sorry, I couldn't generate a response.";

  return { role: "assistant" as const, content: output };
}
