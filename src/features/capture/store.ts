import type { CaptureDraft, CaptureMethod } from './drafts';

// Brouillons transmis entre l'écran de capture et l'écran de vérification
// (en mémoire : rien n'est envoyé au serveur avant la validation).
let current: { method: CaptureMethod; drafts: CaptureDraft[] } | null = null;

export function setCapture(method: CaptureMethod, drafts: CaptureDraft[]): void {
  current = { method, drafts };
}

export function takeCapture(): { method: CaptureMethod; drafts: CaptureDraft[] } | null {
  return current;
}

export function clearCapture(): void {
  current = null;
}

/** Le scan photo par IA payante n'est plus proposé (scanner 100 % gratuit). Réactivable par configuration. */
export const AI_PHOTO_SCAN_ENABLED = process.env.EXPO_PUBLIC_AI_PHOTO_SCAN === 'true';
