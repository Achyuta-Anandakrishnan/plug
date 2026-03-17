"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dalow-theme";

type ThemeMode = "light" | "dark";

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme(getPreferredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/82 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400"
      aria-pressed={theme === "dark"}
      aria-label="Toggle dark mode"
    >
      <span className="h-4 w-4 rounded-full bg-[var(--royal)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.22)]" />
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
