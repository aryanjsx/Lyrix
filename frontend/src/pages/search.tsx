import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { searchHistoryService } from "@/services/searchHistoryService";
import type { SearchResult } from "@/services/api";

export default function SearchPage() {
  const router = useRouter();
  const q = typeof router.query.q === "string" ? router.query.q : "";
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setResults(null);
      setError(null);
    }
  }, [q]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      searchHistoryService.add(suggestion);
      void router.replace(
        `/search?q=${encodeURIComponent(suggestion)}`,
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900/50 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6 sm:pb-8">
        <h1
          className="mb-6 text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Search
        </h1>

        <SearchBar
          initialQuery={q}
          onResults={setResults}
          onLoading={setLoading}
          onError={setError}
        />

        <div className="mt-6">
          {!results && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--text-muted)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
                Search for songs, artists, or podcasts
              </p>
            </div>
          )}

          {(loading || results || error) && (
            <SearchResults
              results={results?.tracks ?? []}
              loading={loading}
              error={error}
              query={q}
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </div>
      </main>
    </div>
  );
}
