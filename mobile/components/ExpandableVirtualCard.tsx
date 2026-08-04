import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { VirtualCard } from '@/components/VirtualCard';
import type { VirtualCardSummary } from '@/lib/types';

const CARD_ASPECT_RATIO = 1.586;
const EXPANDED_SCREEN_FRACTION = 0.8;
const PORTRAIT_ROTATION = 90;

type ExpandableVirtualCardProps = {
  card: VirtualCardSummary;
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
  style?: ViewStyle;
};

function useExpandedPortraitCardSize() {
  const { width, height } = useWindowDimensions();
  const maxVisualWidth = width * EXPANDED_SCREEN_FRACTION;
  const maxVisualHeight = height * EXPANDED_SCREEN_FRACTION;

  // Rotated 90°: on-screen height = card width, on-screen width = card height.
  let cardWidth = maxVisualHeight;
  let cardHeight = cardWidth / CARD_ASPECT_RATIO;

  if (cardHeight > maxVisualWidth) {
    cardHeight = maxVisualWidth;
    cardWidth = cardHeight * CARD_ASPECT_RATIO;
  }

  const slotSize = Math.max(cardWidth, cardHeight);

  return { cardWidth, cardHeight, slotSize };
}

export function ExpandableVirtualCard({
  card,
  stripePublishableKey,
  stripeConnectedAccountId,
  style,
}: ExpandableVirtualCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { cardWidth, cardHeight, slotSize } = useExpandedPortraitCardSize();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (expanded) {
      rotation.value = 0;
      rotation.value = withSpring(PORTRAIT_ROTATION, { damping: 18, stiffness: 180 });
      return;
    }
    rotation.value = 0;
  }, [expanded, rotation]);

  const expandedCardStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel="Expand card">
        <VirtualCard
          card={card}
          stripePublishableKey={stripePublishableKey}
          stripeConnectedAccountId={stripeConnectedAccountId}
          style={style}
        />
      </Pressable>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpanded(false)} />
          <View
            style={[styles.expandedSlot, { width: slotSize, height: slotSize }]}
            pointerEvents="box-none">
            <Animated.View
              style={[
                styles.expandedCard,
                { width: cardWidth, height: cardHeight },
                expandedCardStyle,
              ]}
              pointerEvents="box-none">
              <VirtualCard
                card={card}
                stripePublishableKey={stripePublishableKey}
                stripeConnectedAccountId={stripeConnectedAccountId}
                style={{ width: cardWidth, height: cardHeight }}
              />
            </Animated.View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSlot: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
