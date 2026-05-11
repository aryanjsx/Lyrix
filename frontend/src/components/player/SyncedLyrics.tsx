import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLyrixStore } from "@/store";
import { fetchLyrics, type LyricsResponse } from "@/services/lyricsApi";
import { motion, AnimatePresence } from "framer-motion";

interface LyricLine {
  time: number;
  text: string;
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lineRe = /^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;

  for (const raw of lrc.split("\n")) {
    const m = raw.trim().match(lineRe);
    if (!m) continue;
    const mins = parseInt(m[1], 10);
    const secs = parseInt(m[2], 10);
    const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
    const time = mins * 60 + secs + ms / 1000;
    const text = m[4].trim();
    if (text.length > 0) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function findActiveLine(lines: LyricLine[], position: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].time <= position) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

function PlainLyricsView({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        fontSize: 14,
        lineHeight: 2,
        color: "rgba(255,255,255,0.55)",
        whiteSpace: "pre-wrap",
        overflowY: "auto",
        flex: 1,
      }}
    >
      {text}
    </div>
  );
}

function SyncedLyricsView({ lines }: { lines: LyricLine[] }) {
  const position = useLyrixStore((s) => s.player.position);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const activeIdx = useMemo(() => findActiveLine(lines, position), [lines, position]);

  const setLineRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) lineRefs.current.set(idx, el);
    else lineRefs.current.delete(idx);
  }, []);

  useEffect(() => {
    if (activeIdx < 0) return;
    const el = lineRefs.current.get(activeIdx);
    const container = containerRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll =
      el.offsetTop - container.offsetTop - containerRect.height / 2 + elRect.height / 2;

    container.scrollTo({ top: targetScroll, behavior: "smooth" });
  }, [activeIdx]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px 12px",
        scrollBehavior: "smooth",
        maskImage: "linear-gradient(transparent, black 40px, black calc(100% - 40px), transparent)",
        WebkitMaskImage: "linear-gradient(transparent, black 40px, black calc(100% - 40px), transparent)",
      }}
    >
      {lines.map((line, idx) => {
        const isActive = idx === activeIdx;
        const isPast = idx < activeIdx;

        return (
          <div
            key={`${idx}-${line.time}`}
            ref={(el) => setLineRef(idx, el)}
            style={{
              padding: "8px 4px",
              fontSize: isActive ? 18 : 15,
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1.6,
              color: isActive
                ? "rgba(255,255,255,0.95)"
                : isPast
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(255,255,255,0.40)",
              transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
              transform: isActive ? "scale(1.02)" : "scale(1)",
              transformOrigin: "left center",
              cursor: "default",
            }}
          >
            {line.text}
          </div>
        );
      })}
      <div style={{ height: 120 }} />
    </div>
  );
}

export function SyncedLyrics() {
  const current = useLyrixStore((s) => s.queue.current);
  const duration = useLyrixStore((s) => s.player.duration);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const lastFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!current?.videoId || current.videoId === lastFetchedRef.current) return;
    lastFetchedRef.current = current.videoId;
    setLoading(true);
    setError(false);
    setLyrics(null);

    fetchLyrics(current.videoId, current.title, current.channel, duration || current.duration)
      .then((result) => {
        setLyrics(result);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [current?.videoId, current?.title, current?.channel, current?.duration, duration]);

  const parsedLines = useMemo(() => {
    if (!lyrics?.syncedLyrics) return null;
    const lines = parseLRC(lyrics.syncedLyrics);
    return lines.length > 0 ? lines : null;
  }, [lyrics?.syncedLyrics]);

  if (!current) {
    return (
      <div style={{ padding: "24px 12px", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
        Play a track to see lyrics
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: 20 }}>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", gap: 4 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "rgba(167,139,250,0.6)",
                }}
              />
            ))}
          </motion.div>
        </AnimatePresence>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          Searching for lyrics...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px 12px", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
        Could not load lyrics
      </div>
    );
  }

  if (!lyrics || (!lyrics.syncedLyrics && !lyrics.plainLyrics)) {
    return (
      <div style={{ padding: "24px 12px", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
        No lyrics available for this track
      </div>
    );
  }

  if (parsedLines) {
    return <SyncedLyricsView lines={parsedLines} />;
  }

  if (lyrics.plainLyrics) {
    return <PlainLyricsView text={lyrics.plainLyrics} />;
  }

  return null;
}
