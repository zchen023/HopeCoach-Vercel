// api/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chat } from '../health_agent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, userId = 'user1' } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    if (!message) return res.status(400).json({ error: 'Missing `message`' });

    const reply = await chat(message, userId);
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error(err);
    const msg = err?.message || 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
