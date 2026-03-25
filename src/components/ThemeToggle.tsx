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
    const preferred = getPreferredTheme();
    document.documentElement.setAttribute("data-theme", preferred);
    if (preferred === theme) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setTheme(preferred);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [theme]);

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
      className="theme-toggle"
      aria-pressed={theme === "dark"}
      aria-label="Toggle dark mode"
    >
      <span className="theme-toggle-swatch" />
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
