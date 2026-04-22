"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { ArticlePreview } from "@/lib/types";

export function RaceArticlePicker({
  label,
  placeholder,
  selectedArticle,
  onSelect,
}: {
  label: string;
  placeholder: string;
  selectedArticle: ArticlePreview | null;
  onSelect: (article: ArticlePreview | null) => void;
}) {
  const searchAction = useAction(api.wikipedia.searchWikipedia);
  const rootRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const [query, setQuery] = useState(selectedArticle?.title ?? "");
  const [suggestions, setSuggestions] = useState<ArticlePreview[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setQuery(selectedArticle?.title ?? "");
  }, [selectedArticle?.slug, selectedArticle?.title]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const runSearch = useCallback(
    async (value: string) => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchAction({ query: value.trim() });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchAction],
  );

  const handleChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);

    if (!selectedArticle || value !== selectedArticle.title) {
      onSelect(null);
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      void runSearch(value);
    }, 250);
  };

  const handleSelect = (article: ArticlePreview) => {
    onSelect(article);
    setQuery(article.title);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <label className="block text-sm font-bold">
      {label}
      <div ref={rootRef} className="relative mt-2">
        <input
          type="text"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="bevel-inset w-full bg-white px-3 py-2 text-base outline-none"
        />

        {selectedArticle ? (
          <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#166534]">
            Selected: {selectedArticle.title}
          </div>
        ) : (
          <div className="mt-2 text-xs text-[#7c2d12]">Choose an article from the results list.</div>
        )}

        {isOpen && (suggestions.length > 0 || isLoading) ? (
          <div className="absolute z-50 mt-1 w-full border-2 border-black bg-[#c0c0c0] shadow-lg">
            {isLoading && suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#6b7280]">Searching...</div>
            ) : null}

            {suggestions.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[#000080] hover:text-white"
              >
                {item.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}
