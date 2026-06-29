import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

/** Refetch when a tab/screen gains focus (including the first visit). */
export function useRefreshOnFocus(refresh: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
}
