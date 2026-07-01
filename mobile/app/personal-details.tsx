import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  Lock,
  Phone,
  ScanFace,
  User as UserIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { CountrySelect } from '@/components/CountrySelect';
import { DocumentTypeSelect } from '@/components/DocumentTypeSelect';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useAuth } from '@/contexts/AuthContext';
import { canEditKyc, getDocumentTypeLabel, isKycApproved, isKycPending } from '@/lib/kyc';
import { getCountryCode, getCountryName, type CountryCode } from '@/lib/countries';
import type { DocumentType, KycSubmitPayload, ProfileUpdate, User } from '@/lib/types';
import { colors, radius, spacing } from '@/constants/theme';

const STEPS = [
  { key: 'name', title: 'Your name', subtitle: 'How should we address you?' },
  { key: 'contact', title: 'Contact info', subtitle: 'We need this for account verification' },
  { key: 'address', title: 'Your address', subtitle: 'Required for KYC compliance' },
  { key: 'documents', title: 'Identity document', subtitle: 'Upload a valid government-issued ID' },
  { key: 'selfie', title: 'Selfie verification', subtitle: 'Take a clear photo of your face so we can match it to your ID' },
  { key: 'review', title: 'Review & submit', subtitle: 'Submit for manual approval' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export default function PersonalDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, uploadKycDocument, submitKyc } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('gm');
  const [postalCode, setPostalCode] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [acceptCardTerms, setAcceptCardTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const editable = user ? canEditKyc(user) : false;
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (!user || hydrated) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setDateOfBirth(user.dateOfBirth ?? '');
    setAddress(user.address ?? '');
    setCity(user.city ?? '');
    setCountry(user.country ?? getCountryName(user.countryCode));
    setCountryCode(getCountryCode(user.countryCode ?? user.country) as CountryCode);
    setPostalCode(user.postalCode ?? '');
    setDocumentType((user.documentType as DocumentType | null) ?? null);
    setAcceptCardTerms(Boolean(user.cardTermsAcceptedAt));
    setHydrated(true);
  }, [user, hydrated]);

  useEffect(() => {
    if (!user) return;
    setDocumentType((user.documentType as DocumentType | null) ?? null);
  }, [user?.documentType, user?.documentFrontUrl, user?.documentBackUrl, user?.selfieUrl]);

  if (!user) return null;

  if (!editable) {
    return <KycLockedView user={user} insets={insets} />;
  }

  const getStepFields = (): ProfileUpdate => {
    switch (step.key) {
      case 'name':
        return { firstName: firstName.trim(), lastName: lastName.trim() };
      case 'contact':
        return { phone: phone.trim(), dateOfBirth: dateOfBirth.trim() };
      case 'address':
        return {
          address: address.trim(),
          city: city.trim(),
          country: country.trim(),
          countryCode,
          postalCode: postalCode.trim(),
        };
      case 'documents':
        return documentType ? { documentType } : {};
      default:
        return {};
    }
  };

  const buildSubmitPayload = (): KycSubmitPayload | null => {
    const type = documentType ?? (user.documentType as DocumentType | null);
    if (!type) return null;

    return {
      documentType: type,
      firstName: firstName.trim() || user.firstName?.trim() || '',
      lastName: lastName.trim() || user.lastName?.trim() || '',
      phone: phone.trim() || user.phone?.trim() || '',
      dateOfBirth: dateOfBirth.trim() || user.dateOfBirth?.trim() || '',
      address: address.trim() || user.address?.trim() || '',
      city: city.trim() || user.city?.trim() || '',
      country: country.trim() || user.country?.trim() || getCountryName(countryCode),
      countryCode,
      postalCode: postalCode.trim() || user.postalCode?.trim() || '',
      acceptCardTerms: true as const,
    };
  };

  const validateReview = (): string | null => {
    const payload = buildSubmitPayload();
    if (!payload) return 'Select a document type';
    if (!payload.firstName) return 'First name is required';
    if (!payload.lastName) return 'Last name is required';
    if (!payload.phone) return 'Phone number is required';
    if (payload.phone.length < 6) return 'Enter a valid phone number';
    if (!payload.dateOfBirth) return 'Date of birth is required';
    if (!payload.address) return 'Address is required';
    if (!payload.city) return 'City is required';
    if (!payload.country) return 'Country is required';
    if (!payload.postalCode) return 'Postal code is required';
    if (!acceptCardTerms) return 'You must accept the card terms';
    if (!user.documentFrontUrl) return 'Front of document is required';
    if (!user.selfieUrl) return 'Selfie photo is required';
    return null;
  };

  const validateStep = (): string | null => {
    switch (step.key) {
      case 'name':
        if (!firstName.trim()) return 'First name is required';
        if (!lastName.trim()) return 'Last name is required';
        return null;
      case 'contact':
        if (!phone.trim()) return 'Phone number is required';
        if (phone.trim().length < 6) return 'Enter a valid phone number';
        if (!dateOfBirth.trim()) return 'Date of birth is required';
        return null;
      case 'address':
        if (!address.trim()) return 'Address is required';
        if (!city.trim()) return 'City is required';
        if (!country.trim()) return 'Country is required';
        if (!postalCode.trim()) return 'Postal code is required';
        return null;
      case 'documents':
        if (!documentType) return 'Select a document type';
        if (!user.documentFrontUrl) return 'Front of document is required';
        return null;
      case 'selfie':
        if (!user.selfieUrl) return 'Selfie photo is required';
        return null;
      default:
        return null;
    }
  };

  const handleNext = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (step.key === 'review') {
      const validationError = validateReview();
      if (validationError) {
        setError(validationError);
        return;
      }
      await handleSubmit();
      return;
    }

    if (step.key === 'documents') {
      setError('');
      setLoading(true);
      try {
        if (documentType) {
          await updateProfile({ documentType });
        }
        setStepIndex((i) => i + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setLoading(false);
      }
      return;
    }

    setError('');
    setLoading(true);

    try {
      await updateProfile(getStepFields());
      setStepIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const payload = buildSubmitPayload();
    if (!payload) {
      setError('Select a document type');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await submitKyc(payload);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setError('');
    setStepIndex((i) => i - 1);
  };

  const handleDocumentTypeChange = async (type: DocumentType) => {
    setDocumentType(type);
    setError('');
    try {
      await updateProfile({ documentType: type });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document type');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        {user.kycStatus === 'rejected' && user.kycRejectionReason ? (
          <View style={styles.rejectedBanner}>
            <AlertCircle size={18} color={colors.red500} />
            <View style={styles.rejectedContent}>
              <Text style={styles.rejectedTitle}>Verification rejected</Text>
              <Text style={styles.rejectedBody}>{user.kycRejectionReason}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={22} color={colors.gray900} />
          </Pressable>
          <Text style={styles.screenTitle}>Personal Details</Text>
          <Text style={styles.stepCounter}>
            {stepIndex + 1}/{STEPS.length}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            key={step.key}
            entering={FadeInRight.duration(280)}
            exiting={FadeOutLeft.duration(200)}
            style={styles.stepBody}>
            <StepIcon step={step.key} />
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.subtitle}</Text>

            {step.key === 'name' ? (
              <View style={styles.form}>
                <FormField label="First name" value={firstName} onChangeText={setFirstName} placeholder="Modou" autoFocus />
                <FormField label="Last name" value={lastName} onChangeText={setLastName} placeholder="Jallow" />
              </View>
            ) : null}

            {step.key === 'contact' ? (
              <View style={styles.form}>
                <FormField label="Phone number" value={phone} onChangeText={setPhone} placeholder="+220 712 3456" keyboardType="phone-pad" autoFocus />
                <DateOfBirthPicker value={dateOfBirth} onChange={setDateOfBirth} />
              </View>
            ) : null}

            {step.key === 'address' ? (
              <View style={styles.form}>
                <FormField label="Street address" value={address} onChangeText={setAddress} placeholder="123 Main Street" autoFocus />
                <FormField label="City" value={city} onChangeText={setCity} placeholder="Banjul" />
                <CountrySelect
                  value={countryCode}
                  onChange={(code, name) => {
                    setCountryCode(code);
                    setCountry(name);
                  }}
                />
                <FormField label="Postal code" value={postalCode} onChangeText={setPostalCode} placeholder="00000" />
              </View>
            ) : null}

            {step.key === 'documents' ? (
              <View style={styles.form}>
                <DocumentTypeSelect value={documentType} onChange={handleDocumentTypeChange} />
                <DocumentUpload
                  label="Front of document"
                  hint="Clear photo of the front side"
                  required
                  value={user.documentFrontUrl}
                  onUpload={(uri) => uploadKycDocument('front', uri)}
                />
                <DocumentUpload
                  label="Back of document"
                  hint="Required for ID cards with information on the reverse"
                  value={user.documentBackUrl}
                  onUpload={(uri) => uploadKycDocument('back', uri)}
                />
              </View>
            ) : null}

            {step.key === 'selfie' ? (
              <View style={styles.form}>
                <View style={styles.selfieTips}>
                  <Text style={styles.selfieTipsTitle}>Tips for a good selfie</Text>
                  <Text style={styles.selfieTipsItem}>• Face the camera directly in good lighting</Text>
                  <Text style={styles.selfieTipsItem}>• Remove hats, sunglasses, or face coverings</Text>
                  <Text style={styles.selfieTipsItem}>• Make sure your full face is visible</Text>
                </View>
                <DocumentUpload
                  label="Selfie photo"
                  hint="We will compare this photo to the face on your ID document"
                  required
                  value={user.selfieUrl}
                  cameraFacing="front"
                  primaryAction="camera"
                  onUpload={(uri) => uploadKycDocument('selfie', uri)}
                />
              </View>
            ) : null}

            {step.key === 'review' ? (
              <View style={styles.reviewCard}>
                <ReviewRow label="Name" value={`${firstName} ${lastName}`} />
                <ReviewRow label="Phone" value={phone} />
                <ReviewRow label="Date of birth" value={dateOfBirth} />
                <ReviewRow label="Address" value={address} />
                <ReviewRow label="City" value={city} />
                <ReviewRow label="Country" value={country} />
                <ReviewRow label="Postal code" value={postalCode} />
                <ReviewRow label="Document" value={getDocumentTypeLabel(documentType)} />
                <ReviewRow label="Selfie" value={user.selfieUrl ? 'Uploaded' : 'Missing'} />
                <Pressable
                  style={styles.termsRow}
                  onPress={() => setAcceptCardTerms((value) => !value)}>
                  <View style={[styles.termsCheckbox, acceptCardTerms && styles.termsCheckboxChecked]}>
                    {acceptCardTerms ? <CheckCircle2 size={16} color={colors.white} /> : null}
                  </View>
                  <Text style={styles.termsText}>
                    I accept the Lead Bank Authorized User Terms required to issue my virtual card.
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {isLastStep ? 'Submit for approval' : 'Continue'}
                </Text>
                {isLastStep ? (
                  <CheckCircle2 size={20} color={colors.white} />
                ) : (
                  <ArrowRight size={20} color={colors.white} />
                )}
              </View>
            )}
          </Pressable>

          {isLastStep ? (
            <Text style={styles.reviewNote}>
              Your details will be reviewed manually. You won&apos;t be able to edit them until a decision is made.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function KycLockedView({
  user,
  insets,
}: {
  user: User;
  insets: { top: number; bottom: number };
}) {
  const pending = isKycPending(user);
  const approved = isKycApproved(user);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.gray900} />
        </Pressable>
        <Text style={styles.screenTitle}>Personal Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.lockedContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.statusCard,
            pending && styles.statusPending,
            approved && styles.statusApproved,
          ]}>
          {pending ? (
            <Clock size={32} color={colors.amber600} />
          ) : approved ? (
            <CheckCircle2 size={32} color={colors.emerald600} />
          ) : (
            <Lock size={32} color={colors.gray500} />
          )}
          <Text style={styles.statusTitle}>
            {pending
              ? 'Verification under review'
              : approved
                ? 'Identity verified'
                : 'Details locked'}
          </Text>
          <Text style={styles.statusBody}>
            {pending
              ? 'We are reviewing your submission. You cannot make changes until we complete our review.'
              : approved
                ? 'Your identity has been approved. Personal details and documents can no longer be edited.'
                : 'Your details are currently locked.'}
          </Text>
        </View>

        <View style={styles.reviewCard}>
          <ReviewRow label="Name" value={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()} />
          <ReviewRow label="Phone" value={user.phone ?? '—'} />
          <ReviewRow label="Date of birth" value={user.dateOfBirth ?? '—'} />
          <ReviewRow label="Address" value={user.address ?? '—'} />
          <ReviewRow label="City" value={user.city ?? '—'} />
          <ReviewRow label="Country" value={user.country ?? '—'} />
          <ReviewRow label="Postal code" value={user.postalCode ?? '—'} />
          <ReviewRow label="Document" value={getDocumentTypeLabel(user.documentType)} isLast />
        </View>
      </ScrollView>
    </View>
  );
}

function StepIcon({ step }: { step: StepKey }) {
  const iconProps = { size: 28, color: colors.emerald600 };
  const icons = {
    name: UserIcon,
    contact: Phone,
    address: Home,
    documents: FileText,
    selfie: ScanFace,
    review: CheckCircle2,
  };
  const Icon = icons[step];

  return (
    <View style={styles.stepIconWrap}>
      <Icon {...iconProps} />
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'phone-pad' ? 'none' : 'words'}
        autoFocus={autoFocus}
      />
    </View>
  );
}

function ReviewRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.reviewRow, !isLast && styles.reviewRowBorder]}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.gray50 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  headerSpacer: { width: 40 },
  screenTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
    minWidth: 40,
    textAlign: 'right',
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.gray200,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.emerald600,
    borderRadius: 2,
  },
  content: { paddingHorizontal: spacing.lg, gap: 20, flexGrow: 1 },
  stepBody: { gap: 16, flex: 1 },
  stepIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.emerald100,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  form: { gap: 16 },
  selfieTips: {
    backgroundColor: colors.emerald50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.emerald100,
    padding: 14,
    gap: 6,
  },
  selfieTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    fontFamily: 'Inter_600SemiBold',
  },
  selfieTipsItem: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
  field: { gap: 8 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  reviewRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  reviewRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray50 },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  errorBanner: {
    backgroundColor: colors.red50,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  primaryButton: {
    backgroundColor: colors.emerald600,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  reviewNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.gray500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.emerald600,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsCheckboxChecked: {
    backgroundColor: colors.emerald600,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray700,
    fontFamily: 'Inter_400Regular',
  },
  rejectedBanner: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectedContent: { flex: 1, gap: 4 },
  rejectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red500,
    fontFamily: 'Inter_700Bold',
  },
  rejectedBody: {
    fontSize: 13,
    color: colors.gray700,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  lockedContent: { paddingHorizontal: spacing.lg, gap: 20 },
  statusCard: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  statusPending: {
    backgroundColor: colors.amber100,
    borderColor: '#fde68a',
  },
  statusApproved: {
    backgroundColor: colors.emerald50,
    borderColor: colors.emerald100,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});
