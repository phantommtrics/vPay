export type FundConfig = {
  exchangeRate: number;
  feePercent: number;
  simulationEnabled: boolean;
};

export function formatFundFeeLabel(percent: number): string {
  const value = percent * 100;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1).replace(/\.0$/, '')}%`;
}
