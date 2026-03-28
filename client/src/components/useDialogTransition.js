import { useEffect, useState } from "react";

export default function useDialogTransition(open, duration = 220) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (!isMounted) {
      return undefined;
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, isMounted, open]);

  return { isMounted, isVisible };
}
