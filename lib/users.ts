"use client";

const USER_STORAGE_KEY = "netcarta-user";

export type LocalUser = {
  id: string;
  name: string;
};

function createUser(): LocalUser {
  const fragment = Math.random().toString(36).slice(2, 8);
  return {
    id: `user_${fragment}`,
    name: `Explorer ${fragment.toUpperCase()}`,
  };
}

export function getLocalUser(): LocalUser {
  const stored = window.localStorage.getItem(USER_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored) as LocalUser;
  }

  const fresh = createUser();
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
