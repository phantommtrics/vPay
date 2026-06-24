import 'dotenv/config';

import { approveKyc, findUserByEmail, findUserById, rejectKyc, toPublicUser } from '../src/db.js';
import { provisionUserDirectPayMerchant } from '../src/directpay/provision.js';
import { ensureLegacyProvisioningFields } from '../src/stripe/mappers.js';
import { provisionUserCard } from '../src/stripe/provision.js';

function usage(): never {
  console.log(`Usage:
  npm run admin:approve -- <email>              Approve KYC only
  npm run admin:reject -- <email> [reason]
  npm run admin:provision -- <email>            Provision Stripe card (KYC must be approved)
  npm run admin:provision-directpay -- <email>  Provision directPay merchant (KYC must be approved)

Examples:
  npm run admin:approve -- modou@example.com
  npm run admin:reject -- modou@example.com "Document image is unclear"
  npm run admin:provision -- modou@example.com
  npm run admin:provision-directpay -- modou@example.com
`);
  process.exit(1);
}

async function runDirectPayProvisioning(userId: string, email: string): Promise<void> {
  console.log('Provisioning directPay merchant…');
  await provisionUserDirectPayMerchant(userId);

  const refreshed = await findUserById(userId);
  if (!refreshed) {
    process.exit(1);
  }

  const status = refreshed.directPayProvisioningStatus.toLowerCase();
  if (status === 'active') {
    console.log(`directPay merchant linked: ${refreshed.directPayBusinessId}`);
  } else if (status === 'failed') {
    console.error(
      `directPay provisioning failed: ${refreshed.directPayProvisioningError ?? 'unknown error'}`,
    );
    process.exit(1);
  } else {
    console.log(`directPay provisioning status: ${status}`);
  }
}

async function runProvisioning(userId: string, email: string): Promise<void> {
  let user = await findUserById(userId);
  if (!user) {
    console.error('User not found after approval');
    process.exit(1);
  }

  user = await ensureLegacyProvisioningFields(user);
  if (
    user.postalCode === '00000' ||
    user.countryCode ||
    user.cardTermsAcceptedAt
  ) {
    console.log('Ensured legacy KYC fields required for Stripe provisioning.');
  }

  console.log('Provisioning card…');
  await provisionUserCard(user.id);

  const refreshed = await findUserById(user.id);
  if (!refreshed) {
    process.exit(1);
  }

  const status = refreshed.stripeProvisioningStatus.toLowerCase();
  if (status === 'active') {
    console.log('Card provisioning succeeded.');
  } else if (status === 'failed') {
    console.error(`Card provisioning failed: ${refreshed.stripeProvisioningError ?? 'unknown error'}`);
    process.exit(1);
  } else {
    console.log(`Provisioning status: ${status}`);
  }
}

async function main(): Promise<void> {
  const [command, email, ...rest] = process.argv.slice(2);

  if (!command || !email) {
    usage();
  }

  const normalizedEmail = email.toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    console.error(`No user found for email: ${normalizedEmail}`);
    process.exit(1);
  }

  if (command === 'provision-directpay') {
    if (!user.kycComplete) {
      console.error('User must be KYC-approved before directPay provisioning. Run admin:approve first.');
      process.exit(1);
    }
    await runDirectPayProvisioning(user.id, normalizedEmail);
    return;
  }

  if (command === 'provision') {
    if (!user.kycComplete) {
      console.error('User must be KYC-approved before provisioning. Run admin:approve first.');
      process.exit(1);
    }
    await runProvisioning(user.id, normalizedEmail);
    return;
  }

  if (command === 'approve') {
    if (user.kycStatus === 'APPROVED' && user.kycComplete) {
      console.log(`User already approved: ${normalizedEmail} (${user.id})`);
      return;
    }

    if (user.kycStatus !== 'PENDING') {
      console.error(
        `Cannot approve — KYC status is "${user.kycStatus.toLowerCase()}". User must submit KYC first.`,
      );
      process.exit(1);
    }

    const updated = await approveKyc(user.id);

    console.log('KYC approved');
    console.log(JSON.stringify(toPublicUser(updated), null, 2));
    console.log('');
    console.log('Next steps (optional):');
    console.log(`  npm run admin:provision -- ${normalizedEmail}`);
    console.log(`  npm run admin:provision-directpay -- ${normalizedEmail}`);
    return;
  }

  if (command === 'reject') {
    const reason = rest.join(' ').trim() || 'Rejected by admin';

    if (user.kycStatus !== 'PENDING') {
      console.error(
        `Cannot reject — KYC status is "${user.kycStatus.toLowerCase()}". Only pending submissions can be rejected.`,
      );
      process.exit(1);
    }

    const updated = await rejectKyc(user.id, reason);

    console.log('KYC rejected');
    console.log(JSON.stringify(toPublicUser(updated), null, 2));
    return;
  }

  usage();
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../src/db.js');
    await prisma.$disconnect();
  });
