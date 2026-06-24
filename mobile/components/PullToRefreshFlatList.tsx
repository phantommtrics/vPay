import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

type PullToRefreshFlatListProps<ItemT> = FlatListProps<ItemT> & {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

export function PullToRefreshFlatList<ItemT>({
  refreshing,
  onRefresh,
  ...flatListProps
}: PullToRefreshFlatListProps<ItemT>): ReactElement {
  const insets = useSafeAreaInsets();
  const progressViewOffset = insets.top + spacing.sm;

  return (
    <View style={styles.container}>
      <FlatList
        {...flatListProps}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={colors.emerald800}
            colors={[colors.emerald700]}
            progressBackgroundColor={colors.white}
            progressViewOffset={progressViewOffset}
          />
        }
      />

      {refreshing ? (
        <View
          style={[styles.refreshOverlay, { top: progressViewOffset }]}
          pointerEvents="none">
          <View style={styles.refreshPill}>
            <ActivityIndicator size="small" color={colors.emerald700} />
            <Text style={styles.refreshingText}>Refreshing…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.emerald100,
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.emerald800,
    fontFamily: 'Inter_600SemiBold',
  },
});
