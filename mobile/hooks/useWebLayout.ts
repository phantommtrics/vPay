import { Platform, useWindowDimensions } from 'react-native';

/** Wide consumer web layout. Native apps and narrow browsers stay on the phone UI. */
export const DESKTOP_MIN_WIDTH = 1024;

export function useWebLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= DESKTOP_MIN_WIDTH;
  return { isWeb, isDesktop, width };
}
