"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  // `mounted` gates the icon so SSR (which can't read the DOM) and the first
  // client render agree — avoiding a hydration mismatch. `dark` mirrors the
  // class the no-flash script set on <html> before paint.
  const [state, setState] = useState({ mounted: false, dark: false });

  useEffect(() => {
    // One-time sync from the pre-hydration DOM class.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      mounted: true,
      dark: document.documentElement.classList.contains("dark"),
    });
  }, []);

  function toggle() {
    const dark = !state.dark;
    setState({ mounted: true, dark });
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ignore storage failures */
    }
  }

  return (
    <button
      type="button"
      aria-label={state.dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className="chip"
    >
      {state.mounted && state.dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
