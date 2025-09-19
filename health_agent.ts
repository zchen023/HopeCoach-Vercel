// health_agent.ts
import fetch from "node-fetch";

export type Message = { role: "system" | "user" | "assistant"; content: string };

export async function chat(history: Message[]) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const system: Message = {
    role: "system",
    content:
      "You are HopeCoach: a warm, concise wellbeing coach. Be supportive, practical, and non-judgmental."
  };

  const messages = [system, ...history];

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  const txt = await r.text(); // read text so we can return useful errors
  if (!r.ok) {
    throw new Error(`OpenAI ${r.status}: ${txt.slice(0, 500)}`);
  }

  let data: any;
  try { data = JSON.parse(txt); } catch {
    throw new Error(`OpenAI returned non-JSON: ${txt.slice(0, 500)}`);
  }

  const output =
    data?.choices?.[0]?.message?.content ??
    "Sorry, I couldn't generate a response.";

  return { role: "assistant" as const, content: output };
}

export const respond = chat;
