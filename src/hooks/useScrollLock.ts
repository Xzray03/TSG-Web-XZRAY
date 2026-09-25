import { useEffect } from "react";

let openCount = 0;

export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    openCount++;
    if (openCount === 1) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen]);
}
