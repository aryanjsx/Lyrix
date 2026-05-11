const KNOWN_MUSIC_CHANNELS = new Set([
  "VEVO",
  "Universal Music",
  "Sony Music",
  "Warner Records",
  "Atlantic Records",
  "Republic Records",
  "Interscope Records",
  "Def Jam Recordings",
  "Columbia Records",
  "RCA Records",
  "Capitol Records",
  "Island Records",
  "Virgin Records",
  "Parlophone Records",
  "T-Series",
  "Zee Music Company",
  "Sony Music India",
  "YRF",
  "Speed Records",
  "Desi Music Factory",
  "Times Music",
  "Gaana",
  "JioSaavn",
  "Ultra Music",
  "Spinnin' Records",
  "Monstercat",
  "NCS",
  "Trap Nation",
  "MrSuicideSheep",
  "Proximity",
  "Majestic Casual",
  "The Vibe Guide",
  "xKito Music",
  "ChilledCow",
  "Lofi Girl",
]);

export function isKnownMusicChannel(channelTitle: string): boolean {
  const normalized = channelTitle.trim();
  if (KNOWN_MUSIC_CHANNELS.has(normalized)) return true;
  if (/vevo$/i.test(normalized)) return true;
  return false;
}
