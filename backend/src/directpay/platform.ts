import { prisma } from '../db.js';
import { getDirectPayPartnerConfig } from './partner.js';

export type PlatformDirectPayMerchant = {
  businessId: string;
  slug: string | null;
  holderEmail: string;
};

/** The single vPay platform merchant linked to directPay (one user record holds the ID). */
export async function getPlatformDirectPayMerchant(): Promise<PlatformDirectPayMerchant | null> {
  const holder = await prisma.user.findFirst({
    where: { directPayBusinessId: { not: null } },
    select: { directPayBusinessId: true, directPaySlug: true, email: true },
  });

  if (!holder?.directPayBusinessId) return null;

  return {
    businessId: holder.directPayBusinessId,
    slug: holder.directPaySlug,
    holderEmail: holder.email,
  };
}

export async function isPlatformDirectPayReady(): Promise<boolean> {
  if (!getDirectPayPartnerConfig().configured) return false;
  const merchant = await getPlatformDirectPayMerchant();
  return Boolean(merchant?.businessId);
}
