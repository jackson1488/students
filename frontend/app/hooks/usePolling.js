/**
 * Module: app/hooks/usePolling.js
 *
 * Purpose:
 * - Hook/context module: usePolling. Encapsulates shared stateful behavior.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - usePolling: Custom hook that encapsulates reusable stateful behavior.
 * - run: Helper function used by this module business logic.
 */

import { useEffect, useRef } from "react";

export default function usePolling(callback, delayMs, deps = []) {
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!delayMs || delayMs <= 0) return undefined;

    let isCancelled = false;

    const run = async () => {
      if (isCancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    run();
    const timer = setInterval(run, delayMs);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [delayMs, ...deps]);
}
