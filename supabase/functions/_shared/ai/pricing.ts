// Tarifs publics en USD par million de tokens (à mettre à jour si les tarifs changent).
// Sert à estimer le coût de CHAQUE appel, enregistré dans ai_usage_logs.
interface Price { inputPerMTok: number; outputPerMTok: number }

const PRICES: Record<string, Price> = {
  'claude-opus-5-5':   { inputPerMTok: 4.0,  outputPerMTok: 20.0 },
  'claude-opus-5':     { inputPerMTok: 5.0,  outputPerMTok: 25.0 },
  'claude-opus-4-8':   { inputPerMTok: 5.0,  outputPerMTok: 25.0 },
  'claude-sonnet-5-5': { inputPerMTok: 2.0,  outputPerMTok: 10.0 },
  'claude-sonnet-5':   { inputPerMTok: 2.0,  outputPerMTok: 10.0 },
  'claude-haiku-5-5':  { inputPerMTok: 0.10, outputPerMTok: 0.50 },
};

/** Coût estimé ; un modèle inconnu est valorisé au tarif le plus élevé connu (prudence). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const fallback = Object.values(PRICES).reduce((a, b) => (a.outputPerMTok > b.outputPerMTok ? a : b));
  const p = PRICES[model] ?? fallback;
  const cost = (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
