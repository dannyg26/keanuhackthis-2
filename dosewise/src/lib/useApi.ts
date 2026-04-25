import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: (next: T | ((prev: T | null) => T)) => void;
}

/** Tiny async data hook. Re-runs `fn` whenever any value in `deps` changes. */
export function useApi<T>(fn: () => Promise<T>, deps: ReadonlyArray<unknown> = []): UseApiResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (!cancelledRef.current) setDataState(result);
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e instanceof Error ? e.message : "Request failed");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    cancelledRef.current = false;
    void refetch();
    return () => { cancelledRef.current = true; };
  }, [refetch]);

  const setData = useCallback((next: T | ((prev: T | null) => T)) => {
    setDataState(prev => (typeof next === "function" ? (next as (p: T | null) => T)(prev) : next));
  }, []);

  return { data, loading, error, refetch, setData };
}
