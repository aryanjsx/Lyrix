import type { NextApiRequest, NextApiResponse } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!ADMIN_KEY) {
    res.status(503).json({ error: "Admin key not configured" });
    return;
  }

  const sessionCookie = req.cookies["lyrix_token"];
  if (!sessionCookie) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const authCheck = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Cookie: `lyrix_token=${sessionCookie}` },
  }).catch(() => null);

  if (!authCheck || !authCheck.ok) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  try {
    const upstream = await fetch(`${API_URL}/admin/quota`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Upstream error" });
      return;
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "Failed to reach backend" });
  }
}
