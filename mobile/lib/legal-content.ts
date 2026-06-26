export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: 'June 2025',
  intro:
    'These Terms of Service govern your use of the vPay mobile application and related services operated by vPay Africa. By creating an account or using vPay, you agree to these terms.',
  sections: [
    {
      title: 'About vPay',
      paragraphs: [
        'vPay provides virtual payment cards and a digital wallet that you can fund from supported local mobile money services. Our platform is designed to help you pay online and internationally from your phone.',
      ],
    },
    {
      title: 'Eligibility',
      paragraphs: [
        'You must be at least 18 years old and able to enter a binding agreement to use vPay. You must provide accurate personal information and complete identity verification (KYC) before accessing virtual card features.',
        'We may restrict access based on your country, verification status, or compliance requirements.',
      ],
    },
    {
      title: 'Your account',
      paragraphs: [
        'You sign in using a one-time code sent to your email. You are responsible for keeping access to that email secure and for all activity under your account.',
        'You agree to provide truthful, complete, and up-to-date profile and identity information. We may suspend or close accounts that contain false or misleading information.',
      ],
    },
    {
      title: 'Virtual cards and wallet',
      paragraphs: [
        'After KYC approval, vPay may issue a virtual card linked to your account. Card balances, limits, and availability depend on your verification status and funding activity.',
        'You may top up your vPay wallet and load funds onto your virtual card subject to applicable exchange rates, fees, and processing times shown in the app before you confirm a transaction.',
        'Virtual cards are for lawful personal use only. You may not use vPay for fraud, money laundering, sanctions evasion, or any illegal activity.',
      ],
    },
    {
      title: 'Identity verification',
      paragraphs: [
        'To comply with financial regulations, we require government-issued identification and supporting details before issuing cards or enabling full wallet features.',
        'Submitting KYC documents authorizes vPay and its partners to verify your identity and may require manual review. We may approve, reject, or request additional information at our discretion.',
      ],
    },
    {
      title: 'Funding and payments',
      paragraphs: [
        'Wallet top-ups are processed through our payment partner, Direct Pay, using supported gateways such as Wave and APS Wallet. When you fund your wallet, you also agree to any terms required by the selected payment provider.',
        'Funding amounts may be converted from local currency (for example, GMD) to the card currency shown in the app. Exchange rates and platform fees are disclosed before you confirm each funding request.',
        'Completed wallet payments are generally final. Chargebacks or reversals may not be available once funds have been credited, except where required by law.',
      ],
    },
    {
      title: 'Fees',
      paragraphs: [
        'vPay may charge fees on funding, currency conversion, or other services. Applicable fees are displayed in the app before you authorize a transaction. We may update fees with reasonable notice where required.',
      ],
    },
    {
      title: 'Security',
      paragraphs: [
        'You may enable optional app lock or biometric unlock on your device. You remain responsible for securing your device and email access.',
        'Notify us promptly if you suspect unauthorized access to your account or card.',
      ],
    },
    {
      title: 'Suspension and termination',
      paragraphs: [
        'We may suspend, limit, or terminate your access if you violate these terms, fail verification, pose a compliance risk, or if required by law or our banking and card partners.',
        'You may stop using vPay at any time. Provisions that should survive termination will continue to apply.',
      ],
    },
    {
      title: 'Disclaimers',
      paragraphs: [
        'vPay is provided on an "as is" and "as available" basis to the fullest extent permitted by law. We do not guarantee uninterrupted service, specific exchange rates, or merchant acceptance of your virtual card.',
        'Nothing in these terms limits rights you may have under applicable consumer protection laws.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may update these terms from time to time. Material changes will be reflected in the app with an updated date. Continued use after changes take effect constitutes acceptance of the revised terms.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        'For questions about these Terms of Service, contact vPay support through the Help & Support option in the app.',
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'June 2025',
  intro:
    'This Privacy Policy explains how vPay Africa collects, uses, and protects your information when you use the vPay app and related services.',
  sections: [
    {
      title: 'Information we collect',
      paragraphs: [
        'Account information: email address, name, phone number, date of birth, and address you provide during registration and profile setup.',
        'Identity verification data: government ID images, document type, and other KYC materials you upload for manual review.',
        'Financial activity: wallet balances, funding requests, card provisioning status, and transaction history shown in the app.',
        'Device and usage data: app interactions, security settings such as app lock preferences, and technical logs needed to operate and protect the service.',
      ],
    },
    {
      title: 'How we use your information',
      paragraphs: [
        'We use your information to create and secure your account, verify your identity, issue and manage virtual cards, process wallet top-ups, display balances and activity, and provide customer support.',
        'We also use data to detect fraud, meet legal and regulatory obligations, improve the app, and communicate with you about your account or important service updates.',
      ],
    },
    {
      title: 'Sharing with partners',
      paragraphs: [
        'We share information only as needed to deliver vPay services:',
        '• Direct Pay — to process wallet funding through supported mobile money gateways (such as Wave and APS Wallet).',
        '• Card and banking partners — to issue virtual cards, manage card balances, and process card transactions.',
        '• Identity and compliance providers — to verify KYC submissions and meet anti–money laundering requirements.',
        '• Infrastructure providers — such as email delivery and cloud hosting, under contractual confidentiality and security obligations.',
        'We do not sell your personal information.',
      ],
    },
    {
      title: 'Data retention',
      paragraphs: [
        'We retain account, KYC, and transaction records for as long as your account is active and as required by law, regulation, or legitimate business needs such as dispute resolution and audit.',
        'You may request account closure; some data may be kept where retention is legally required.',
      ],
    },
    {
      title: 'Security',
      paragraphs: [
        'We use technical and organizational measures to protect your data, including encrypted connections, access controls, and secure storage for sensitive materials such as identity documents.',
        'No method of transmission or storage is completely secure. Please use a strong device passcode and protect access to your email account.',
      ],
    },
    {
      title: 'Your choices and rights',
      paragraphs: [
        'You can update profile details in the app where your verification status allows. You may enable or disable optional security features such as app lock on supported devices.',
        'Depending on your location, you may have rights to access, correct, delete, or restrict certain processing of your personal data. Contact support to submit a request.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        'vPay is not intended for anyone under 18. We do not knowingly collect personal information from children.',
      ],
    },
    {
      title: 'International transfers',
      paragraphs: [
        'Your information may be processed in countries other than where you live, including by partners that help us provide card and payment services. We take steps to ensure appropriate safeguards where required.',
      ],
    },
    {
      title: 'Changes to this policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. The "Last updated" date at the top will change when we do. Continued use of vPay after an update means you accept the revised policy.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        'For privacy questions or requests, contact vPay support through Help & Support in the app.',
      ],
    },
  ],
};
