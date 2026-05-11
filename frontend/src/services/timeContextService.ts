export type TimeSlot =
  | "early_morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "late_night";

export interface TimeContext {
  slot: TimeSlot;
  label: string;
  greeting: string;
  searchTerms: string[];
  moodTags: string[];
}

const TIME_CONTEXTS: Record<TimeSlot, Omit<TimeContext, "slot">> = {
  early_morning: {
    label: "Early morning",
    greeting: "Rise and shine",
    searchTerms: [
      "morning acoustic music",
      "gentle wake up songs",
      "soft morning playlist",
      "peaceful morning music",
    ],
    moodTags: ["calm", "acoustic", "gentle", "soft"],
  },
  morning: {
    label: "Morning",
    greeting: "Good morning",
    searchTerms: [
      "upbeat morning songs",
      "feel good music",
      "motivational morning playlist",
      "energetic start songs",
    ],
    moodTags: ["upbeat", "energetic", "happy", "positive"],
  },
  afternoon: {
    label: "Afternoon",
    greeting: "Good afternoon",
    searchTerms: [
      "lo-fi hip hop focus",
      "instrumental focus music",
      "concentration music playlist",
      "work from home music",
    ],
    moodTags: ["focus", "instrumental", "lo-fi", "study"],
  },
  evening: {
    label: "Evening",
    greeting: "Good evening",
    searchTerms: [
      "chill evening music",
      "after work unwind songs",
      "relaxing evening playlist",
      "sunset vibes music",
    ],
    moodTags: ["chill", "relax", "sunset", "mellow"],
  },
  night: {
    label: "Night",
    greeting: "Good night",
    searchTerms: [
      "night drive music playlist",
      "late night chill songs",
      "night vibes music",
      "moody night playlist",
    ],
    moodTags: ["night", "moody", "deep", "atmospheric"],
  },
  late_night: {
    label: "Late night",
    greeting: "Still up?",
    searchTerms: [
      "late night ambient music",
      "dark ambient songs",
      "midnight playlist",
      "3am music playlist",
    ],
    moodTags: ["ambient", "dark", "introspective", "quiet"],
  },
};

export function getTimeSlot(hour?: number): TimeSlot {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 8) return "early_morning";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  if (h >= 21) return "night";
  return "late_night";
}

export function getTimeContext(hour?: number): TimeContext {
  const slot = getTimeSlot(hour);
  return { slot, ...TIME_CONTEXTS[slot] };
}

export function getMinutesUntilNextSlot(): number {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const boundaries = [5, 8, 12, 17, 21, 24];
  const next = boundaries.find((b) => b > h) ?? 24;
  return (next - h) * 60 - m;
}
