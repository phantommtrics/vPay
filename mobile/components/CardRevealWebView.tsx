import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { createEphemeralKey, issuingElementsUrl } from '@/lib/api';
import { colors } from '@/constants/theme';
import type { VirtualCardSummary } from '@/lib/types';

type CardRevealWebViewProps = {
  active: boolean;
  card: VirtualCardSummary;
  publishableKey: string | null;
  stripeConnectedAccountId: string | null;
  holderName?: string;
  expiry?: string;
  style?: ViewStyle;
};

export function CardRevealWebView({
  active,
  card,
  publishableKey,
  stripeConnectedAccountId,
  holderName,
  expiry,
  style,
}: CardRevealWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const startedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    startedRef.current = false;
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (active) {
      reset();
    }
  }, [active, reset, card.id]);

  const sendCommand = useCallback((payload: Record<string, unknown>) => {
    const json = JSON.stringify(payload);
    webViewRef.current?.injectJavaScript(
      `(function(){try{var d=${json};if(window.__vpayHandleCommand){window.__vpayHandleCommand(d);}}catch(e){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message||'Command failed'}));}}})();true;`,
    );
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          nonce?: string;
          message?: string;
        };

        if (data.type === 'loaded') {
          if (startedRef.current) return;
          startedRef.current = true;
          sendCommand({ type: 'reveal', cardId: card.stripeCardId });
          return;
        }

        if (data.type === 'nonce' && data.nonce) {
          const key = await createEphemeralKey(card.id, data.nonce);
          sendCommand({
            type: 'mount',
            cardId: key.stripeCardId,
            nonce: data.nonce,
            ephemeralKeySecret: key.ephemeralKeySecret,
          });
          return;
        }

        if (data.type === 'allReady') {
          setLoading(false);
          return;
        }

        if (data.type === 'error') {
          setError(data.message ?? 'Failed to load card details');
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load card details');
        setLoading(false);
      }
    },
    [card.id, card.stripeCardId, sendCommand],
  );

  if (!active || !publishableKey) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        key={`${card.id}-inline`}
        source={{
          uri: issuingElementsUrl({
            publishableKey,
            stripeAccount: stripeConnectedAccountId,
            layout: 'card',
            holder: holderName,
            expiry,
          }),
        }}
        onMessage={handleMessage}
        originWhitelist={['*']}
        scrollEnabled={false}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        onError={() => {
          setError('Could not load card details.');
          setLoading(false);
        }}
        onHttpError={() => {
          setError('Could not reach the card viewer.');
          setLoading(false);
        }}
      />

      {loading && !error ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.white} size="small" />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorOverlay} pointerEvents="none">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  webviewContainer: {
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 11,
    textAlign: 'center',
  },
});
