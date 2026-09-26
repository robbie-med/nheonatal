/**
 * AAP 2022 Hyperbilirubinemia Calculator
 * Uses complete hour-by-hour AAP 2022 threshold data
 *
 * Original API documentation: https://peditools.org/bili2022/bili2022_api.html
 * (API disabled due to CORS - using local AAP 2022 tables)
 */

import { BiliInputs, BiliOutputs, BiliApiResponse } from '../types';
import { getPhotoThreshold, getExchangeThreshold } from './biliThresholds';

const PEDITOOLS_API_BASE = 'https://peditools.org/bili2022/api/';

/**
 * Calculate age in hours from birth time and sample time
 */
export function calculateAgeHours(birthTime: string, sampleTime: string): number {
  const birth = new Date(birthTime);
  const sample = new Date(sampleTime);
  const diffMs = sample.getTime() - birth.getTime();
  return Math.round(diffMs / (1000 * 60 * 60) * 10) / 10;
}

/**
 * Convert GA weeks and days to decimal weeks
 */
function gaToDecimal(weeks: number, days: number): number {
  return weeks + days / 7;
}

/**
 * Calculate local thresholds using AAP 2022 hour-by-hour data
 */
function calculateLocalThresholds(
  gaWeeks: number,
  _gaDays: number, // Included for API compatibility, GA weeks used for table lookup
  ageHours: number,
  hasRiskFactors: boolean
): { photo: number; exchange: number } {
  const photo = getPhotoThreshold(gaWeeks, ageHours, hasRiskFactors);
  const exchange = getExchangeThreshold(gaWeeks, ageHours, hasRiskFactors);

  return { photo, exchange };
}

/**
 * Management guidance per AAP 2022 (Kemper et al., Pediatrics 2022;150(3):e2022058859):
 * escalation of care at exchange threshold minus 2 mg/dL, and the post-birth
 * hospitalization follow-up table (Figure 5) for infants who have NOT received
 * phototherapy, as presented by PediTools bili2022.
 */
function generateFollowupGuidance(
  tsbValue: number,
  photoThreshold: number,
  exchangeThreshold: number,
  ageHours: number,
  gaWeeks: number
): string {
  const prefix = gaWeeks < 35 ? 'GA <35w: AAP 2022 thresholds do not apply (35w values shown). ' : '';
  const below = Math.round((photoThreshold - tsbValue) * 10) / 10;

  let text: string;
  if (tsbValue >= exchangeThreshold) {
    text = 'At/above exchange transfusion threshold. Urgent exchange transfusion; emergent intensive phototherapy and PO + IV hydration; urgent transfer to NICU capable of exchange transfusion.';
  } else if (tsbValue >= exchangeThreshold - 2) {
    text = 'At/above escalation-of-care threshold (exchange - 2). Emergent intensive phototherapy and PO + IV hydration; urgent transfer to NICU capable of exchange transfusion; STAT labs; TSB at least every 2 hours.';
  } else if (below <= 0) {
    text = 'At/above phototherapy threshold. Initiate phototherapy; measure TSB within 12 hours of starting.';
  } else if (below < 2) {
    text = ageHours < 24
      ? 'Below phototherapy threshold by <2. Delay discharge, consider phototherapy, measure TSB in 4-8 hours.'
      : 'Below phototherapy threshold by <2. Measure TSB in 4-24 hours; options: delay discharge and consider phototherapy, home phototherapy if criteria met, or discharge with close follow-up.';
  } else if (below < 3.5) {
    text = 'Below phototherapy threshold. If discharging: TSB or TcB in 4-24 hours.';
  } else if (below < 5.5) {
    text = 'Below phototherapy threshold. If discharging: TSB or TcB in 1-2 days.';
  } else if (below < 7) {
    text = ageHours < 72
      ? 'Below phototherapy threshold. If discharging: follow-up within 2 days; TcB or TSB per clinical judgment.'
      : 'Below phototherapy threshold. If discharging: follow-up per clinical judgment.';
  } else {
    text = ageHours < 72
      ? 'Below phototherapy threshold. If discharging: follow-up within 3 days; TcB or TSB per clinical judgment.'
      : 'Below phototherapy threshold. If discharging: follow-up per clinical judgment.';
  }
  return prefix + text;
}

/**
 * Fetch bili thresholds from PediTools API
 */
export async function fetchBiliFromAPI(
  gaWeeks: number,
  gaDays: number,
  ageHours: number,
  tsbValue: number,
  hasRiskFactors: boolean
): Promise<BiliApiResponse | null> {
  const ga = gaToDecimal(gaWeeks, gaDays);
  const risk = hasRiskFactors ? 'any' : 'none';

  const url = `${PEDITOOLS_API_BASE}?ga=${ga.toFixed(1)}&age=${Math.round(ageHours)}&bili=${tsbValue}&risk=${risk}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('PediTools API returned error:', response.status);
      return null;
    }

    const data = await response.json();

    // Parse the API response
    // The API returns data in a specific format - adapt as needed
    if (data && typeof data === 'object') {
      return {
        ga: data.ga || ga,
        age: data.age || ageHours,
        bili: data.bili || tsbValue,
        risk: data.risk || risk,
        photo_threshold: data.photo_threshold || data.photo || 0,
        exchange_threshold: data.exchange_threshold || data.exchange || 0,
        above_photo: data.above_photo || false,
        above_exchange: data.above_exchange || false
      };
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch from PediTools API:', error);
    return null;
  }
}

/**
 * Main bilirubin calculation function
 */
export async function calculateBili(
  inputs: BiliInputs,
  useApi = true
): Promise<BiliOutputs> {
  const { gestationalAgeWeeks, gestationalAgeDays, ageHours, tsbValue, hasNeurotoxRiskFactors } = inputs;

  let photoThreshold: number;
  let exchangeThreshold: number;
  let apiResponse: BiliApiResponse | undefined;
  let isCached = false;

  // Try API first if enabled
  if (useApi) {
    const response = await fetchBiliFromAPI(
      gestationalAgeWeeks,
      gestationalAgeDays,
      ageHours,
      tsbValue,
      hasNeurotoxRiskFactors
    );

    if (response) {
      photoThreshold = response.photo_threshold;
      exchangeThreshold = response.exchange_threshold;
      apiResponse = response;
    } else {
      // Use local AAP 2022 calculation
      const local = calculateLocalThresholds(
        gestationalAgeWeeks,
        gestationalAgeDays,
        ageHours,
        hasNeurotoxRiskFactors
      );
      photoThreshold = local.photo;
      exchangeThreshold = local.exchange;
      isCached = true;
    }
  } else {
    // Use local AAP 2022 calculation
    const local = calculateLocalThresholds(
      gestationalAgeWeeks,
      gestationalAgeDays,
      ageHours,
      hasNeurotoxRiskFactors
    );
    photoThreshold = local.photo;
    exchangeThreshold = local.exchange;
  }

  const deltaToPhoto = Math.round((tsbValue - photoThreshold) * 10) / 10;
  const followupGuidance = generateFollowupGuidance(tsbValue, photoThreshold, exchangeThreshold, ageHours, gestationalAgeWeeks);

  return {
    photoThreshold: Math.round(photoThreshold * 10) / 10,
    exchangeThreshold: Math.round(exchangeThreshold * 10) / 10,
    deltaToPhoto,
    followupGuidance,
    apiResponse,
    isCached
  };
}

/**
 * Calculate bili synchronously with local AAP 2022 thresholds
 */
export function calculateBiliSync(inputs: BiliInputs): BiliOutputs {
  const { gestationalAgeWeeks, gestationalAgeDays, ageHours, tsbValue, hasNeurotoxRiskFactors } = inputs;

  const thresholds = calculateLocalThresholds(
    gestationalAgeWeeks,
    gestationalAgeDays,
    ageHours,
    hasNeurotoxRiskFactors
  );

  const deltaToPhoto = Math.round((tsbValue - thresholds.photo) * 10) / 10;
  const followupGuidance = generateFollowupGuidance(tsbValue, thresholds.photo, thresholds.exchange, ageHours, gestationalAgeWeeks);

  return {
    photoThreshold: thresholds.photo,
    exchangeThreshold: thresholds.exchange,
    deltaToPhoto,
    followupGuidance,
    isCached: false
  };
}

/**
 * Format a Date as a local datetime-local input value (YYYY-MM-DDTHH:mm).
 * toISOString returns UTC, which would mis-render in datetime-local inputs.
 */
export function toLocalInputValue(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/**
 * Get default bili inputs
 */
export function getDefaultBiliInputs(): BiliInputs {
  const now = new Date();
  const birth = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  return {
    gestationalAgeWeeks: 39,
    gestationalAgeDays: 0,
    birthTime: toLocalInputValue(birth),
    sampleTime: toLocalInputValue(now),
    ageHours: 18,
    tsbValue: 8.0,
    hasNeurotoxRiskFactors: false
  };
}
