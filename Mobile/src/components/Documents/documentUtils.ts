import type { DocumentItem } from '../../store/slices/documentsSlice';

export function formatDocDate(date?: string | null): string {
  if (!date) return 'No expiry found';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No expiry found';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getDocumentStatusMeta(doc?: DocumentItem | null) {
  if (!doc) {
    return {
      label: 'Missing',
      caption: 'Tap to add',
      tone: '#A1A1AA',
      bg: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.08)',
    };
  }

  if (doc.status === 'expired') {
    return {
      label: 'Expired',
      caption: `Expired ${formatDocDate(doc.expiryDate)}`,
      tone: '#FB7185',
      bg: 'rgba(251,113,133,0.14)',
      border: 'rgba(251,113,133,0.35)',
    };
  }

  if (doc.status === 'expiring') {
    return {
      label: 'Expiring',
      caption: `Due ${formatDocDate(doc.expiryDate)}`,
      tone: '#F59E0B',
      bg: 'rgba(245,158,11,0.14)',
      border: 'rgba(245,158,11,0.35)',
    };
  }

  return {
    label: doc.verificationStatus === 'VERIFIED' ? 'Verified' : 'Stored',
    caption: doc.expiryDate ? `Valid till ${formatDocDate(doc.expiryDate)}` : 'Ready in glovebox',
    tone: '#22C55E',
    bg: 'rgba(34,197,94,0.14)',
    border: 'rgba(34,197,94,0.35)',
  };
}
