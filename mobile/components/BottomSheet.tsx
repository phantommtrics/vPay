import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
};

function animateWithKeyboard(event?: KeyboardEvent) {
  if (Platform.OS === 'ios') {
    LayoutAnimation.configureNext({
      duration: event?.duration && event.duration > 0 ? event.duration : 250,
      update: { type: LayoutAnimation.Types.keyboard },
    });
    return;
  }

  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function BottomSheet({
  visible,
  onClose,
  children,
  dismissible = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const syncKeyboardInset = useCallback(() => {
    const keyboardTop = keyboardTopRef.current;
    const node = overlayRef.current;
    if (keyboardTop == null || !node) {
      setKeyboardInset(0);
      return;
    }

    node.measureInWindow((_x, y, _w, height) => {
      const overlayBottom = y + height;
      setKeyboardInset(Math.max(0, Math.round(overlayBottom - keyboardTop)));
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      keyboardTopRef.current = null;
      setKeyboardInset(0);
      return;
    }

    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        keyboardTopRef.current = event.endCoordinates.screenY;
        animateWithKeyboard(event);
        requestAnimationFrame(syncKeyboardInset);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        keyboardTopRef.current = null;
        animateWithKeyboard(event);
        setKeyboardInset(0);
      },
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible, syncKeyboardInset]);

  const close = () => {
    if (!dismissible) return;
    Keyboard.dismiss();
    onClose();
  };

  const keyboardOpen = keyboardInset > 0;
  const sheetMaxHeight = keyboardOpen
    ? Math.max(windowHeight - keyboardInset - spacing.lg, windowHeight * 0.4)
    : windowHeight * 0.88;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}>
      <View ref={overlayRef} style={styles.backdrop} onLayout={syncKeyboardInset}>
        <Pressable
          style={styles.backdropHit}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              marginBottom: keyboardInset,
              paddingBottom: keyboardOpen
                ? spacing.md
                : Math.max(insets.bottom, spacing.md) + spacing.md,
            },
          ]}
          accessibilityViewIsModal>
          <View style={styles.handle} />
          <ScrollView
            style={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropHit: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
});
