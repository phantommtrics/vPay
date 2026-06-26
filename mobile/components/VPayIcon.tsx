import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';

type VPayIconProps = {
  width?: number;
  height?: number;
};

export function VPayIcon({ width = 200, height = 160 }: VPayIconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 200 160"
      accessibilityRole="image"
      accessibilityLabel="VPay Africa icon">
      <G transform="translate(100, 80)">
        <G transform="rotate(-8) translate(-84, -54)">
          <Rect x="0" y="0" width="168" height="108" rx="14" fill="#0F2D6B" />
          <Rect
            x="0"
            y="0"
            width="168"
            height="108"
            rx="14"
            fill="none"
            stroke="#1A3F8F"
            strokeWidth="1.5"
          />
          <Rect x="0" y="30" width="168" height="22" fill="#0D2560" />
          <Rect x="14" y="68" width="28" height="20" rx="4" fill="#C8922A" fillOpacity="0.9" />
          <Rect x="50" y="68" width="28" height="20" rx="4" fill="#C8922A" fillOpacity="0.55" />
          <Circle cx="118" cy="78" r="14" fill="#E8A020" fillOpacity="0.25" />
          <Circle cx="132" cy="78" r="14" fill="#E8A020" fillOpacity="0.18" />
          <SvgText
            x="84"
            y="22"
            fontFamily="System"
            fontSize="11"
            fontWeight="600"
            fill="#4A6FA8"
            textAnchor="middle"
            letterSpacing="2">
            VPAY
          </SvgText>
        </G>

        <Rect x="-84" y="-54" width="168" height="108" rx="14" fill="#1A4DB8" />
        <Rect
          x="-84"
          y="-54"
          width="168"
          height="108"
          rx="14"
          fill="none"
          stroke="#2860D4"
          strokeWidth="1"
        />
        <Rect x="-84" y="-24" width="168" height="20" fill="#163FA0" />
        <Circle cx="62" cy="16" r="15" fill="#E8A020" fillOpacity="0.22" />
        <Circle cx="76" cy="16" r="15" fill="#E8A020" fillOpacity="0.16" />
        <Rect x="-70" y="10" width="30" height="18" rx="3" fill="#D4921C" fillOpacity="0.8" />
        <SvgText
          x="-70"
          y="-33"
          fontFamily="System"
          fontSize="10"
          fontWeight="600"
          fill="#5A8AE0"
          letterSpacing="2">
          VPAY
        </SvgText>

        <Polyline
          points="-28,-10 0,28 28,-10"
          fill="none"
          stroke="#C8841A"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polyline
          points="-28,-10 0,28 28,-10"
          fill="none"
          stroke="#F5BC3A"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
