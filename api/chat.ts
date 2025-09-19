// api/chat.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
// For TS on Vercel, import without extension
import { chat } from "../health_agent";

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body ?? {};
    if (!Array.isArray(messages)) {
      throw new Error("Expected body: { messages: [{ role, content }, ...] }");
    }

    const reply = await chat(messages);
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    return res.status(200).json({ reply });
  } catch (err: any) {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
