import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";
import { prisma } from "./quotaService";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_DURATION_S = Math.floor(SESSION_DURATION_MS / 1000);

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

interface JWTPayload {
  userId: string;
  email: string;
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** OAuth URL with YouTube Data scope (re-auth / sync). */
export function getGoogleYouTubeSyncAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/youtube",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function getGoogleProfile(
  accessToken: string
): Promise<GoogleProfile> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Profile fetch failed: ${response.status}`);
  }

  return (await response.json()) as GoogleProfile;
}

export async function upsertUser(
  profile: GoogleProfile,
  tokens: GoogleTokenResponse
) {
  return prisma.user.upsert({
    where: { googleId: profile.sub },
    create: {
      googleId: profile.sub,
      email: profile.email,
      displayName: profile.name,
      avatarUrl: profile.picture ?? null,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token ?? null,
      googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      displayName: profile.name,
      avatarUrl: profile.picture ?? null,
      googleAccessToken: tokens.access_token,
      ...(tokens.refresh_token
        ? { googleRefreshToken: tokens.refresh_token }
        : {}),
      googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

export async function refreshAccessToken(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleAccessToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleRefreshToken) return null;

  if (user.googleTokenExpiry && user.googleTokenExpiry > new Date()) {
    return user.googleAccessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: user.googleRefreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    console.error(
      `[Auth] Token refresh failed for user ${userId}: ${response.status}`
    );
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: SESSION_DURATION_S,
  } as jwt.SignOptions);
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
  }) as JWTPayload;
}
