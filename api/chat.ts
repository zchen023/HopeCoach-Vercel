// api/chat.ts
import { chat } from "../health_agent";

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body: any = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    const messages = Array.isArray(body?.messages) ? body.messages : undefined;
    if (!messages) {
      return res.status(400).json({ error: "Expected body: { messages: [{ role, content }, ...] }" });
    }

    const reply = await chat(messages);
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("HopeCoach API error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
