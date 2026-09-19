/** Small data-fetching hooks so pages stay declarative. */

import { useCallback, useEffect, useState, useRef } from 'react';
import { api } from './api.js';

export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!path) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get(path, { signal: controller.signal })
      .then((res) => { if (mounted.current) { setData(res); setError(null); } })
      .catch((err) => {
        if (err.name === 'AbortError' || !mounted.current) return;
        setError(err);
      })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Debounce a value, for search inputs that drive requests. */
export function useDebounced(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
