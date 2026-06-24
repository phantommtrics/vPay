import type { ImageSourcePropType } from 'react-native';

export type Transaction = {
  id: number | string;
  merchant: string;
  amount: number;
  date: string;
  type: 'purchase' | 'funding' | 'subscription' | 'service';
  status?: string;
  icon: string;
};

export type FundingSource = {
  id: 'aps' | 'wave';
  name: string;
  logo: ImageSourcePropType;
  /** Zoom past baked-in image padding so the mark fills the logo slot. */
  logoScale?: number;
};

export const fundingSources: FundingSource[] = [
  { id: 'aps', name: 'APS Wallet', logo: require('@/assets/images/funding/aps-wallet.jpeg'), logoScale: 1.35 },
  { id: 'wave', name: 'Wave', logo: require('@/assets/images/funding/wave.jpeg'), logoScale: 1.08 },
];

export const recentTransactions: Transaction[] = [
  {
    id: 1,
    merchant: 'Netflix',
    amount: -15.99,
    date: 'Today',
    type: 'subscription',
    icon: '🎬',
  },
  {
    id: 2,
    merchant: 'APS Wallet Funding',
    amount: 50.0,
    date: 'Yesterday',
    type: 'funding',
    icon: '💰',
  },
  {
    id: 3,
    merchant: 'AWS Cloud',
    amount: -12.45,
    date: 'Oct 24',
    type: 'service',
    icon: '☁️',
  },
];

export const allTransactions: Transaction[] = [
  {
    id: 1,
    merchant: 'Netflix',
    amount: -15.99,
    date: 'Today, 10:42 AM',
    type: 'purchase',
    status: 'completed',
    icon: '🎬',
  },
  {
    id: 2,
    merchant: 'APS Wallet Funding',
    amount: 50.0,
    date: 'Yesterday, 2:15 PM',
    type: 'funding',
    status: 'completed',
    icon: '💰',
  },
  {
    id: 3,
    merchant: 'AWS Cloud',
    amount: -12.45,
    date: 'Oct 24, 8:00 AM',
    type: 'purchase',
    status: 'completed',
    icon: '☁️',
  },
  {
    id: 4,
    merchant: 'Spotify Premium',
    amount: -9.99,
    date: 'Oct 21, 11:30 AM',
    type: 'purchase',
    status: 'completed',
    icon: '🎵',
  },
  {
    id: 5,
    merchant: 'Wave Funding',
    amount: 100.0,
    date: 'Oct 18, 4:20 PM',
    type: 'funding',
    status: 'completed',
    icon: '🌊',
  },
  {
    id: 6,
    merchant: 'Facebook Ads',
    amount: -25.0,
    date: 'Oct 15, 9:10 AM',
    type: 'purchase',
    status: 'completed',
    icon: '📢',
  },
];

export function formatAmount(amount: number) {
  const prefix = amount > 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(amount).toFixed(2)}`;
}
