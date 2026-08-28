"use client";

import { useEffect } from "react";

export function DevToolsGuard() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

      // Ctrl+Shift+I / Cmd+Option+I (Inspect)
      // Ctrl+Shift+J / Cmd+Option+J (Console)
      // Ctrl+Shift+C / Cmd+Option+C (Inspect Element)
      if (
        (isMac && e.metaKey && e.altKey && ["i", "I", "j", "J", "c", "C"].includes(e.key)) ||
        (!isMac && e.ctrlKey && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+U / Cmd+U (View Source)
      if (
        (isMac && e.metaKey && ["u", "U"].includes(e.key)) ||
        (!isMac && e.ctrlKey && ["u", "U"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  return null;
}
