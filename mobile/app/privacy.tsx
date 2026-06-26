import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { PRIVACY_POLICY } from '@/lib/legal-content';

export default function PrivacyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} />;
}
