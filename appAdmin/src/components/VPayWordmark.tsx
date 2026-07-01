type VPayWordmarkProps = {
  width?: number;
  height?: number;
  variant?: 'light' | 'dark';
};

export function VPayWordmark({ width = 220, height = 72, variant = 'dark' }: VPayWordmarkProps) {
  const isDark = variant === 'dark';
  const brandColor = isDark ? '#FFFFFF' : '#0A1628';
  const subColor = isDark ? '#8A95A8' : '#6B7A92';
  const vColor = isDark ? '#4A80E8' : '#1A4DB8';

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 220 72"
      role="img"
      aria-label="VPay Africa wordmark">
      <text fontFamily="Inter, system-ui, sans-serif" fontSize="46" fontWeight="700" letterSpacing="-1.5">
        <tspan x="4" y="46" fill={vColor}>
          V
        </tspan>
        <tspan fill={brandColor}>Pay</tspan>
      </text>
      <text
        x="5"
        y="64"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="12"
        fontWeight="500"
        letterSpacing="5.5"
        fill={subColor}>
        AFRICA
      </text>
      <rect x="4" y="68" width="52" height="2" rx="1" fill="#E8A020" />
    </svg>
  );
}
