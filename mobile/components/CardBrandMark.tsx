import { Svg, Circle, Text as SvgText } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

type CardBrandMarkProps = {
  brand: string;
  size?: number;
};

function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase();
}

function VisaMark({ size }: { size: number }) {
  return (
    <View style={[styles.badge, { width: size * 1.6, height: size }]}>
      <Svg width={size * 1.6} height={size} viewBox="0 0 48 16">
        <SvgText
          x="24"
          y="12"
          fill="#ffffff"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Inter">
          VISA
        </SvgText>
      </Svg>
    </View>
  );
}

function MastercardMark({ size }: { size: number }) {
  const r = size * 0.38;
  const cy = size / 2;
  const leftCx = size * 0.38;
  const rightCx = size * 0.62;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={leftCx} cy={cy} r={r} fill="rgba(235, 50, 35, 0.95)" />
        <Circle cx={rightCx} cy={cy} r={r} fill="rgba(247, 158, 27, 0.95)" />
      </Svg>
    </View>
  );
}

function AmexMark({ size }: { size: number }) {
  return (
    <View style={[styles.badge, styles.amexBadge, { width: size * 1.7, height: size }]}>
      <Svg width={size * 1.7} height={size} viewBox="0 0 52 16">
        <SvgText
          x="26"
          y="12"
          fill="#ffffff"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Inter">
          AMEX
        </SvgText>
      </Svg>
    </View>
  );
}

function DiscoverMark({ size }: { size: number }) {
  return (
    <View style={[styles.badge, { width: size * 2, height: size }]}>
      <Svg width={size * 2} height={size} viewBox="0 0 60 16">
        <SvgText
          x="30"
          y="12"
          fill="#ffffff"
          fontSize="8"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Inter">
          DISCOVER
        </SvgText>
      </Svg>
    </View>
  );
}

function GenericMark({ brand, size }: { brand: string; size: number }) {
  const label = brand.slice(0, 8).toUpperCase();
  return (
    <View style={[styles.badge, { minWidth: size * 1.4, height: size, paddingHorizontal: 6 }]}>
      <Svg height={size} width={size * 1.4} viewBox="0 0 40 16">
        <SvgText
          x="20"
          y="12"
          fill="#ffffff"
          fontSize="8"
          fontWeight="600"
          textAnchor="middle"
          fontFamily="Inter">
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

export function CardBrandMark({ brand, size = 32 }: CardBrandMarkProps) {
  const normalized = normalizeBrand(brand);

  if (normalized === 'visa') {
    return <VisaMark size={size} />;
  }

  if (normalized === 'mastercard') {
    return <MastercardMark size={size} />;
  }

  if (normalized === 'amex' || normalized === 'american_express') {
    return <AmexMark size={size} />;
  }

  if (normalized === 'discover') {
    return <DiscoverMark size={size} />;
  }

  return <GenericMark brand={normalized || 'card'} size={size} />;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amexBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
  },
});
