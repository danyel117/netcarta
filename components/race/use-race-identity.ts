"use client";

import { useCallback, useEffect, useState } from "react";

const PLAYER_TOKEN_KEY = "netcarta-player-token";
const DISPLAY_NAME_KEY = "netcarta-display-name";

function createPlayerToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `player-${Math.random().toString(36).slice(2, 10)}`;
}

export function useRaceIdentity() {
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(PLAYER_TOKEN_KEY);
    const nextToken = storedToken || createPlayerToken();

    if (!storedToken) {
      window.localStorage.setItem(PLAYER_TOKEN_KEY, nextToken);
    }

    setPlayerToken(nextToken);
    setDisplayNameState(window.localStorage.getItem(DISPLAY_NAME_KEY) ?? "");
    setIsHydrated(true);
  }, []);

  const setDisplayName = useCallback((value: string) => {
    setDisplayNameState(value);
    window.localStorage.setItem(DISPLAY_NAME_KEY, value);
  }, []);

  return {
    playerToken,
    displayName,
    setDisplayName,
    isHydrated,
  };
}
