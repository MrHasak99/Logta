/**
 * Logta data layer — public API for the API routes / server code.
 * (Node-only: uses better-sqlite3. Do not import from browser components.)
 */
export { getDb, setDb, createDb, type DB } from '../db/client.ts';
export * from '../db/schema.ts';
export { normalizeAlias, parseSize, toBaseQty, detectLang } from './normalize.ts';
export { matchLine, learnAlias, confirmMatch, sizeAgrees, FUZZY_ACCEPT, LEARN_THRESHOLD, type MatchResult, type MatchCandidate, type MatchOptions } from './matching.ts';
export {
  recordObservation,
  trustScore,
  getCurrentPrice,
  getPriceMatrix,
  getPriceHistory,
  priceStats,
  estimateCurrentPrice,
  weightedMedian,
  EVIDENCE_WEIGHT,
  TAU_DAYS,
  type RecordObservationInput,
  type RecordObservationResult,
  type CurrentPrice,
  type PriceMatrix,
  type SourceMix,
} from './prices.ts';
export { optimizeBasket, optimizeItems, haversineKm, type BasketPlan, type OptimizeOptions, type LatLng, type BasketItemInput } from './optimizer.ts';
export { checkAlerts, getAlertsForUser, markAlertSeen, type AlertResult } from './alerts.ts';
export { ingestUnmatched, promotePending, listPending, isReadyForPromotion, type PromoteDetails } from './catalog-growth.ts';
export { ingestReceipt, resolveLineWithLlm, resolveStore, type IngestReport, type IngestedLine, type IngestOptions, type LlmResolver } from './ingest.ts';
export * from './llm-contract.ts';
