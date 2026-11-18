import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { OcrLine } from './receipt';

// Lecture de texte 100 % locale (ML Kit, sur le téléphone, hors ligne, gratuite).
// Indisponible dans la version web : l'écran propose alors la saisie manuelle.
export const ocrAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const MAX_EDGE = 2000; // assez de détails pour lire un ticket, sans image inutilement lourde

async function prepare(uri: string, width: number, height: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const saved = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return saved.uri;
}

export async function recognizeLines(photo: { uri: string; width: number; height: number }): Promise<{ lines: OcrLine[]; text: string }> {
  if (!ocrAvailable) throw new Error('ocr_unavailable');
  // Import différé : le module natif n'existe pas sur le web.
  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const result = await TextRecognition.recognize(await prepare(photo.uri, photo.width, photo.height));
  const lines: OcrLine[] = result.blocks.flatMap((b) => b.lines.map((l) => ({ text: l.text, frame: l.frame })));
  return { lines, text: result.text };
}
