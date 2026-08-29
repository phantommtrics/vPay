import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { AppLockProvider } from '@/contexts/AppLockContext';
import { AppLockGate } from '@/components/AppLockGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ForceUpdateGate } from '@/components/ForceUpdateGate';
import { StartupGate } from '@/components/StartupGate';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) {
      console.warn('Font loading failed, falling back to system fonts', error);
    }
  }, [error]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
      <StartupGate>
        <ForceUpdateGate>
          <AuthProvider>
            <AppLockProvider>
              <AppLockGate>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="personal-details"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="security"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="verify-credential"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="set-pin"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="confirm-pin"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="set-password"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="confirm-password"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="delete-account"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="help-support"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="send-request"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="my-tickets"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="ticket/[id]"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="terms"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                  <Stack.Screen
                    name="privacy"
                    options={{ presentation: 'card', animation: 'slide_from_right' }}
                  />
                </Stack>
              </AppLockGate>
            </AppLockProvider>
          </AuthProvider>
        </ForceUpdateGate>
      </StartupGate>
    </ErrorBoundary>
  );
}
