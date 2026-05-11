import { Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import {
  generateOAuthState,
  getGoogleAuthUrl,
  getGoogleYouTubeSyncAuthUrl,
  exchangeCodeForTokens,
  getGoogleProfile,
  upsertUser,
  signJWT,
  SESSION_DURATION_MS,
} from "../services/authService";
import { prisma } from "../services/quotaService";
import { trackEvent, captureError } from "../services/telemetry";

const RETURN_PLAYLIST_ID_COOKIE = "return_playlist_id";

const PLAYLIST_CUID_REGEX = /^c[a-z0-9]{24}$/;

const isProduction = config.nodeEnv === "production";

const cookieOpts = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/" as const,
};

export function handleGoogleAuth(_req: Request, res: Response): void {
  const state = generateOAuthState();

  res.cookie("oauth_state", state, {
    ...cookieOpts,
    maxAge: 10 * 60 * 1000,
  });

  const authUrl = getGoogleAuthUrl(state);
  res.redirect(authUrl);
}

export function handleYouTubeSyncAuth(req: Request, res: Response): void {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const raw = req.query.returnPlaylistId;
  const returnPlaylistId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  if (
    typeof returnPlaylistId !== "string" ||
    !PLAYLIST_CUID_REGEX.test(returnPlaylistId)
  ) {
    res.status(400).json({ error: "Valid returnPlaylistId is required" });
    return;
  }

  const state = generateOAuthState();

  res.cookie("oauth_state", state, {
    ...cookieOpts,
    maxAge: 10 * 60 * 1000,
  });

  res.cookie(RETURN_PLAYLIST_ID_COOKIE, returnPlaylistId, {
    ...cookieOpts,
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(getGoogleYouTubeSyncAuthUrl(state));
}

export async function handleGoogleCallback(
  req: Request,
  res: Response
): Promise<void> {
  const code = req.query.code as string | undefined;
  const queryState = req.query.state as string | undefined;
  const cookieState = req.cookies?.oauth_state as string | undefined;

  if (!code) {
    res.redirect(`${config.frontendUrl}?auth=error&reason=no_code`);
    return;
  }

  if (
    !cookieState ||
    !queryState ||
    cookieState.length !== queryState.length ||
    !crypto.timingSafeEqual(
      Buffer.from(cookieState),
      Buffer.from(queryState)
    )
  ) {
    res.redirect(`${config.frontendUrl}?auth=error&reason=invalid_state`);
    return;
  }

  res.clearCookie("oauth_state");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getGoogleProfile(tokens.access_token);
    const user = await upsertUser(profile, tokens);

    const jwtToken = signJWT({ userId: user.id, email: user.email });

    res.cookie("lyrix_token", jwtToken, {
      ...cookieOpts,
      maxAge: SESSION_DURATION_MS,
    });

    trackEvent("user_login", { method: "google" }, user.id);

    const returnPlaylistId = req.cookies?.[
      RETURN_PLAYLIST_ID_COOKIE
    ] as string | undefined;

    if (
      returnPlaylistId &&
      PLAYLIST_CUID_REGEX.test(returnPlaylistId)
    ) {
      res.clearCookie(RETURN_PLAYLIST_ID_COOKIE, cookieOpts);
      res.redirect(
        `${config.frontendUrl}/playlists/${returnPlaylistId}?sync=enabled&token=${jwtToken}`
      );
      return;
    }

    if (returnPlaylistId) {
      res.clearCookie(RETURN_PLAYLIST_ID_COOKIE, cookieOpts);
    }

    res.redirect(`${config.frontendUrl}?auth=success&token=${jwtToken}`);
  } catch (err) {
    captureError(err as Error);
    console.error("[Auth] Callback error:", err);
    res.redirect(`${config.frontendUrl}?auth=error&reason=exchange_failed`);
  }
}

export async function handleGetMe(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.clearCookie("lyrix_token");
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export function handleLogout(_req: Request, res: Response): void {
  res.clearCookie("lyrix_token", cookieOpts);
  res.json({ success: true });
}
