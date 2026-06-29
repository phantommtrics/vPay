import { StripeProvisioningStatus, VirtualCardStatus, type User } from '@prisma/client';

import { prisma } from '../db.js';
import { sendCardReadyEmail } from '../email.js';
import { log } from '../logger.js';
import { isStripeConfigured, getIssuingCurrency } from './client.js';
import { assertProvisioningReady } from './mappers.js';
import {
  createConnectedAccount,
  createFinancialAccount,
  waitForAccountCapabilities,
} from './connect.js';
import {
  createCardholder,
  createVirtualCard,
  enableIssuingProgram,
} from './issuing.js';

function toCardStatus(status: 'active' | 'inactive' | 'canceled'): VirtualCardStatus {
  switch (status) {
    case 'inactive':
      return VirtualCardStatus.INACTIVE;
    case 'canceled':
      return VirtualCardStatus.CANCELED;
    default:
      return VirtualCardStatus.ACTIVE;
  }
}

export async function provisionUserCard(userId: string): Promise<void> {
  if (!isStripeConfigured()) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeProvisioningStatus: StripeProvisioningStatus.FAILED,
        stripeProvisioningError: 'Stripe is not configured',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.kycComplete) {
    throw new Error('KYC must be approved before card provisioning');
  }

  const existingCard = await prisma.virtualCard.findFirst({ where: { userId } });
  if (existingCard) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeProvisioningStatus: StripeProvisioningStatus.ACTIVE },
    });
    return;
  }

  let currentUser = user;

  // Clear partial Stripe state from a previous failed attempt so cardholder/card can be recreated.
  if (
    currentUser.stripeProvisioningStatus === StripeProvisioningStatus.FAILED &&
    (currentUser.stripeConnectedAccountId || currentUser.stripeFinancialAccountId)
  ) {
    currentUser = await prisma.user.update({
      where: { id: userId },
      data: {
        stripeConnectedAccountId: null,
        stripeFinancialAccountId: null,
      },
    });
    log('Cleared partial Stripe state for reprovision', { userId });
  }

  try {
    assertProvisioningReady(user);

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeProvisioningStatus: StripeProvisioningStatus.PENDING,
        stripeProvisioningError: null,
      },
    });

    const connectedAccountId =
      currentUser.stripeConnectedAccountId ?? (await createConnectedAccount(currentUser));

    await prisma.user.update({
      where: { id: userId },
      data: { stripeConnectedAccountId: connectedAccountId },
    });

    await waitForAccountCapabilities(connectedAccountId);

    const financialAccountId =
      currentUser.stripeFinancialAccountId ?? (await createFinancialAccount(connectedAccountId));

    await prisma.user.update({
      where: { id: userId },
      data: { stripeFinancialAccountId: financialAccountId },
    });

    await enableIssuingProgram(connectedAccountId);

    const cardholderId = await createCardholder(currentUser, connectedAccountId);
    const issued = await createVirtualCard(
      currentUser,
      connectedAccountId,
      cardholderId,
      financialAccountId,
    );

    await prisma.virtualCard.create({
      data: {
        userId,
        stripeCardId: issued.stripeCardId,
        stripeCardholderId: issued.stripeCardholderId,
        last4: issued.last4,
        brand: issued.brand,
        expMonth: issued.expMonth,
        expYear: issued.expYear,
        status: toCardStatus(issued.status),
        currency: getIssuingCurrency(),
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeProvisioningStatus: StripeProvisioningStatus.ACTIVE,
        stripeProvisioningError: null,
      },
    });

    log('Card provisioning completed', { userId, cardId: issued.stripeCardId });

    try {
      await sendCardReadyEmail(currentUser.email, {
        firstName: currentUser.firstName,
        last4: issued.last4,
      });
      log('Card ready email sent', { userId, email: currentUser.email });
    } catch (err) {
      log('Card ready email failed', {
        userId,
        email: currentUser.email,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown provisioning error';
    log('Card provisioning failed', { userId, error: message });

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeProvisioningStatus: StripeProvisioningStatus.FAILED,
        stripeProvisioningError: message,
      },
    });
  }
}

export function scheduleCardProvisioning(userId: string): void {
  void provisionUserCard(userId);
}
