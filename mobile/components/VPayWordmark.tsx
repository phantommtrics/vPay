import { useColorScheme } from 'react-native';
import Svg, { Rect, Text as SvgText, TSpan } from 'react-native-svg';

type VPayWordmarkProps = {
  width?: number;
  height?: number;
  /** Force light-on-dark or dark-on-light colors instead of system scheme. */
  variant?: 'auto' | 'light' | 'dark';
};

export function VPayWordmark({
  width = 220,
  height = 72,
  variant = 'auto',
}: VPayWordmarkProps) {
  const scheme = useColorScheme();
  const isDark =
    variant === 'dark' ? true : variant === 'light' ? false : scheme === 'dark';

  const brandColor = isDark ? '#FFFFFF' : '#0A1628';
  const subColor = isDark ? '#8A95A8' : '#6B7A92';
  const vColor = isDark ? '#4A80E8' : '#1A4DB8';

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 220 72"
      accessibilityRole="image"
      accessibilityLabel="VPay Africa wordmark">
      <SvgText fontFamily="System" fontSize="46" fontWeight="700" letterSpacing="-1.5">
        <TSpan x="4" y="46" fill={vColor}>
          V
        </TSpan>
        <TSpan fill={brandColor}>Pay</TSpan>
      </SvgText>

      <SvgText
        x="5"
        y="64"
        fontFamily="System"
        fontSize="12"
        fontWeight="500"
        letterSpacing="5.5"
        fill={subColor}>
        AFRICA
      </SvgText>

      <Rect x="4" y="68" width="52" height="2" rx="1" fill="#E8A020" />
    </Svg>
  );
}
