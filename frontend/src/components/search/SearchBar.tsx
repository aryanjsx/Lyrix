import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import { searchTracks, SearchResult } from "@/services/api";
import { searchHistoryService } from "@/services/searchHistoryService";
import { getTrendingSearches } from "@/services/suggestionsService";
import { SearchHistoryDropdown } from "./SearchHistoryDropdown";
import { SuggestionsDropdown } from "./SuggestionsDropdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SearchBarProps {
  initialQuery?: string;
  onResults?: (result: SearchResult) => void;
  onLoading?: (loading: boolean) => void;
  onError?: (error: string | null) => void;
}

export function SearchBar({
  initialQuery = "",
  onResults,
  onLoading,
  onError,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isSearchable = router.pathname === "/" || router.pathname === "/search";

  const [isFocused, setIsFocused] = useState(false);
  const [historyEntries, setHistoryEntries] = useState(() =>
    searchHistoryService.getRecent()
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [trending, setTrending] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const trendingFetchedRef = useRef(false);

  const showSuggestions =
    isFocused && query.trim().length >= 2 && suggestions.length > 0;
  const showDropdown =
    isFocused &&
    query.trim() === "" &&
    !showSuggestions &&
    (historyEntries.length > 0 || trending.length > 0);

  const totalDropdownItems = showSuggestions
    ? suggestions.length
    : historyEntries.length + trending.length;

  const refreshHistory = useCallback(() => {
    setHistoryEntries(searchHistoryService.getRecent());
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        onResults?.({ tracks: [], source: "youtube" });
        onError?.(null);
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      onLoading?.(true);
      onError?.(null);

      try {
        const result = await searchTracks(searchQuery, controller.signal);
        if (!controller.signal.aborted) {
          onResults?.(result);
          if (result.tracks.length === 0) {
            onError?.("No music found. Try a different search.");
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : "Couldn't load results. Try again.";
          onError?.(message);
          onResults?.({ tracks: [], source: "youtube" });
        }
      } finally {
        if (!controller.signal.aborted) {
          onLoading?.(false);
        }
      }
    },
    [onResults, onLoading, onError]
  );

  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery.trim().length >= 2) {
      performSearch(initialQuery.trim());
    }
  }, [initialQuery, performSearch]);

  const navigateToSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < 2) return;

      searchHistoryService.add(trimmed);
      refreshHistory();

      if (isSearchable) {
        const path = router.pathname === "/search"
          ? `/search?q=${encodeURIComponent(trimmed)}`
          : `/?q=${encodeURIComponent(trimmed)}`;
        void router.replace(path, undefined, { shallow: true });
        performSearch(trimmed);
      } else {
        void router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [isSearchable, router, performSearch, refreshHistory]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isSearchable) {
      debounceRef.current = setTimeout(() => {
        navigateToSearch(value);
      }, 400);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setIsFocused(false);
    setHighlightedIndex(-1);
    navigateToSearch(query);
  };

  const handleHistorySelect = useCallback(
    (q: string) => {
      setQuery(q);
      setIsFocused(false);
      setHighlightedIndex(-1);
      navigateToSearch(q);
    },
    [navigateToSearch]
  );

  const handleHistoryRemove = useCallback(
    (q: string) => {
      searchHistoryService.remove(q);
      refreshHistory();
    },
    [refreshHistory]
  );

  const handleHistoryClear = useCallback(() => {
    searchHistoryService.clear();
    setHistoryEntries([]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions || showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, totalDropdownItems - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        if (showSuggestions) {
          const selected = suggestions[highlightedIndex];
          if (selected) handleHistorySelect(selected);
        } else {
          const isHistory = highlightedIndex < historyEntries.length;
          const selected = isHistory
            ? historyEntries[highlightedIndex].query
            : trending[highlightedIndex - historyEntries.length];
          if (selected) handleHistorySelect(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        setIsFocused(false);
        setHighlightedIndex(-1);
        return;
      }
    }
  };

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/search/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch {
        setSuggestions([]);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (isFocused && !trendingFetchedRef.current) {
      trendingFetchedRef.current = true;
      getTrendingSearches().then(setTrending).catch(() => {});
    }
  }, [isFocused]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 max-w-full">
      <div ref={containerRef} className="relative min-w-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            refreshHistory();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search songs, artists, podcasts..."
          className="w-full min-w-0 max-w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-shadow focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search for music or podcasts"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        <SuggestionsDropdown
          isVisible={showSuggestions}
          suggestions={suggestions}
          onSelect={handleHistorySelect}
          highlightedIndex={highlightedIndex}
        />

        <SearchHistoryDropdown
          isVisible={showDropdown}
          entries={historyEntries}
          onSelect={handleHistorySelect}
          onRemove={handleHistoryRemove}
          onClearAll={handleHistoryClear}
          highlightedIndex={highlightedIndex}
          trendingSuggestions={trending}
        />
      </div>
    </form>
  );
}
