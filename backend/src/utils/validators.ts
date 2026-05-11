export const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function paramStr(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}
