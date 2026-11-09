"use client";

import { SunMoon } from "lucide-react";

// Light or dark. With no choice made the page follows the system; a choice sets data-theme on
// <html> (app/globals.css reads it) and is remembered. app/layout.tsx re-applies it before paint.

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("theme", root.dataset.theme);
    } catch {
      // Private mode: the choice lasts until reload.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
      title="Light or dark"
      className="pressable flex size-8 cursor-pointer items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-fill/60 hover:text-ink"
    >
      <SunMoon size={17} />
    </button>
  );
}
