import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { TERMS_OF_SERVICE } from '@/lib/legal-content';

export default function TermsScreen() {
  return <LegalDocumentScreen document={TERMS_OF_SERVICE} />;
}
