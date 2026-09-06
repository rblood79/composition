import { useState, useEffect, useCallback } from "react";
import {
  readLocalVitals,
  startLocalWebVitals,
  subscribeLocalVitals,
  type LocalVitals,
} from "../../../performance/localWebVitals";

export type WebVitals = LocalVitals;

export function useWebVitals({ enabled = true }: { enabled?: boolean } = {}) {
  const [vitals, setVitals] = useState(readLocalVitals);
  useEffect(() => {
    startLocalWebVitals();
    if (!enabled) return;
    const update = () => setVitals(readLocalVitals());
    update();
    return subscribeLocalVitals(update);
  }, [enabled]);
  const collectLocalVitals = useCallback(() => {
    const current = readLocalVitals();
    setVitals(current);
    return current;
  }, []);
  return { vitals, collectLocalVitals, requestVitals: collectLocalVitals };
}
