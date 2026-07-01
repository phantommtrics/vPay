import { useCallback, useEffect, useState } from 'react';

type PageResult<T> = {
  items: T[];
  nextCursor: string | null;
};

type FetchPage<T> = (params: { cursor?: string; limit: number }) => Promise<PageResult<T>>;

export function useCursorPagination<T>(
  fetchPage: FetchPage<T>,
  limit: number,
  resetKey: string | number,
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(undefined);
  }, [resetKey, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchPage({ cursor: currentCursor, limit })
      .then(({ items: data, nextCursor: next }) => {
        if (cancelled) return;
        setItems(data);
        setNextCursor(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setItems([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, currentCursor, limit]);

  const canGoBack = cursorStack.length > 0;
  const canGoForward = nextCursor !== null;

  const goNext = useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, currentCursor]);
    setCurrentCursor(nextCursor);
  }, [nextCursor, currentCursor]);

  const goPrev = useCallback(() => {
    setCursorStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setCurrentCursor(prev);
      return stack.slice(0, -1);
    });
  }, []);

  return { items, loading, error, canGoBack, canGoForward, goNext, goPrev };
}
