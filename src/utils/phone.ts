/**
 * Canonical Nigerian Phone Normalization Utility
 * 
 * Handles all formats:
 * - 08012345678 (11-digit national with leading 0)
 * - +2348012345678 (Standard E.164 with +)
 * - 2348012345678 (E.164 without +)
 * - 0801 234 5678 (spaced or hyphenated)
 * - 8012345678 (10-digit subscriber number)
 * 
 * In Nigeria, the unique subscriber number is always the last 10 digits
 * starting with 7, 8, or 9 (e.g. 70..., 80..., 81..., 90..., 91...).
 */

export interface NormalizedPhone {
  subscriber10: string; // Exactly 10 digits, e.g. "8012345678"
  national11: string;   // Exactly 11 digits with leading 0, e.g. "08012345678"
  e164: string;         // Standard E.164 with +234, e.g. "+2348012345678"
  display: string;      // Formatted for display, e.g. "0801 234 5678"
  isValid: boolean;     // Whether it meets valid mobile structure
}

export function normalizePhone(raw: string): NormalizedPhone {
  if (!raw || typeof raw !== 'string') {
    return {
      subscriber10: '',
      national11: '',
      e164: '',
      display: '',
      isValid: false,
    };
  }

  const digits = raw.replace(/\D/g, '');
  let subscriber = '';

  if (digits.startsWith('234') && digits.length >= 13) {
    subscriber = digits.slice(3, 13);
  } else if (digits.startsWith('0') && digits.length === 11) {
    subscriber = digits.slice(1);
  } else if (digits.length === 10) {
    subscriber = digits;
  } else if (digits.length > 10) {
    subscriber = digits.slice(-10);
  } else {
    subscriber = digits;
  }

  const isValid = subscriber.length === 10 && /^[789]\d{9}$/.test(subscriber);
  const national11 = subscriber.length === 10 ? `0${subscriber}` : digits;
  const e164 = subscriber.length === 10 ? `+234${subscriber}` : (raw.startsWith('+') ? `+${digits}` : `+234${digits}`);
  const display = subscriber.length === 10 
    ? `0${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`
    : raw.trim();

  return {
    subscriber10: subscriber,
    national11,
    e164,
    display,
    isValid,
  };
}

/**
 * Compare two phone representations for exact identity match
 */
export function isSamePhone(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  if (normA.subscriber10 && normB.subscriber10 && normA.subscriber10.length === 10 && normB.subscriber10.length === 10) {
    return normA.subscriber10 === normB.subscriber10;
  }
  const cleanA = phoneA.replace(/\D/g, '');
  const cleanB = phoneB.replace(/\D/g, '');
  return cleanA === cleanB || (cleanA.length >= 10 && cleanB.length >= 10 && cleanA.slice(-10) === cleanB.slice(-10));
}

export function isValidNigerianPhone(phone: string): boolean {
  return normalizePhone(phone).isValid;
}

export function formatNigerianPhone(phone: string): string {
  return normalizePhone(phone).display;
}
