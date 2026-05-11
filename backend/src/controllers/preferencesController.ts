import { Request, Response } from "express";
import { prisma } from "../services/quotaService";
import { captureError } from "../services/telemetry";

const VALID_LANGUAGES = new Set([
  "hindi", "english", "punjabi", "tamil", "telugu", "bengali",
  "marathi", "kannada", "malayalam", "korean", "spanish", "arabic",
  "japanese", "urdu", "bhojpuri", "haryanvi", "gujarati", "rajasthani",
]);

function validateLanguages(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const { languages } = body as { languages?: unknown };
  if (!Array.isArray(languages)) return null;

  const valid = languages.filter(
    (l): l is string => typeof l === "string" && VALID_LANGUAGES.has(l)
  );
  if (valid.length === 0) return null;
  return valid;
}

export async function handleGetPreferences(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { preferredLanguages: true },
    });

    const languages = Array.isArray(user?.preferredLanguages)
      ? user.preferredLanguages
      : [];

    res.json({ languages });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
}

export async function handleUpdatePreferences(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const languages = validateLanguages(req.body);
  if (!languages) {
    res.status(400).json({ error: "languages must be a non-empty array of valid language IDs" });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { preferredLanguages: languages },
    });

    res.json({ success: true, languages });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to save preferences" });
  }
}
