"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LandingSearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/waitlist");
  };

  return (
    <form className="landing-search-bar" onSubmit={handleSubmit} role="search">
      <svg className="landing-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        className="landing-search-input"
        placeholder="Search anything…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          if (!value.trim()) return;
          router.push("/waitlist");
        }}
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
}
