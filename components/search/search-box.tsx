"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ slug: string; title: string }>
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const searchAction = useAction(api.wikipedia.searchWikipedia);

  const debouncedSearch = useCallback(
    async (value: string) => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchAction({ query: value });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchAction],
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  };

  const handleSelect = (slug: string) => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    router.push(`/articles/${encodeURIComponent(slug)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const slug =
        suggestions[0]?.slug || query.trim().replace(/\s+/g, "_");
      handleSelect(slug);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Find an article..."
          className="bevel-inset w-full bg-white px-2 py-1 text-sm outline-none"
        />
      </form>

      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 mt-1 w-full border-2 border-black bg-[#c0c0c0] shadow-lg">
          {isLoading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-sm text-[#6b7280]">
              Searching...
            </div>
          )}

          {suggestions.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => handleSelect(item.slug)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-[#000080] hover:text-white"
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
