import { useEffect, useRef, useState } from "react";
import { useLyrixStore } from "@/store";
import { fetchMixes } from "@/services/recommendationApi";
import { SmartMixCard } from "./SmartMixCard";

const LOAD_TIMEOUT_MS = 8_000;

export function SmartMixGrid() {
  const mixes = useLyrixStore((s) => s.recommendations.mixes);
  const loading = useLyrixStore((s) => s.recommendations.mixesLoading);
  const setMixes = useLyrixStore((s) => s.setMixes);
  const setLoading = useLyrixStore((s) => s.setRecoLoading);
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const [attempted, setAttempted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn || mixes.length > 0 || loading || attempted) return;
    setLoading("mixesLoading", true);

    timerRef.current = setTimeout(() => {
      setLoading("mixesLoading", false);
      setAttempted(true);
    }, LOAD_TIMEOUT_MS);

    fetchMixes()
      .then((result) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setMixes(result);
        setAttempted(true);
      })
      .catch(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setLoading("mixesLoading", false);
        setAttempted(true);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoggedIn, mixes.length, loading, attempted, setMixes, setLoading]);

  if (!isLoggedIn || mixes.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Your Mixes</h2>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {mixes.map((mix) => (
          <SmartMixCard key={mix.id} mix={mix} />
        ))}
      </div>
    </section>
  );
}
