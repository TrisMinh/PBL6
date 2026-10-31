import { useEffect, useRef } from "react";

export interface SeatAttempt {
  begin: () => AbortController | null;
  finish: () => void;
  isAlive: () => boolean;
}
export function useSeatAttempt(): SeatAttempt {
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  return {
    begin: () => {
      if (lock.current || !alive.current) return null;
      lock.current = true;
      controller.current = new AbortController();
      return controller.current;
    },
    finish: () => {
      lock.current = false;
    },
    isAlive: () => alive.current,
  };
}
