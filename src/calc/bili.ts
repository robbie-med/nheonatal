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
 * Generate follow-up guidance based on TSB and thresholds
 */
function generateFollowupGuidance(
  tsbValue: number,
  photoThreshold: number,
  ageHours: number
): string {
  const delta = tsbValue - photoThreshold;

  if (delta >= 0) {
    return 'TSB at or above phototherapy threshold. Initiate phototherapy per protocol. Recheck TSB in 4-6 hours.';
  } else if (delta >= -2) {
    return 'TSB approaching phototherapy threshold. Recheck TSB in 4-6 hours. Ensure adequate feeding and hydration.';
  } else if (delta >= -4) {
    if (ageHours < 48) {
      return 'Below phototherapy threshold. Recheck TSB in 8-12 hours or before discharge. Monitor feeding.';
    } else {
      return 'Below phototherapy threshold. Recheck TSB in 12-24 hours or at follow-up visit. Monitor feeding and stool output.';
    }
  } else {
    if (ageHours < 24) {
      return 'Well below threshold. Routine feeding support. Consider recheck before discharge based on risk factors.';
    } else {
      return 'Well below threshold. Routine feeding support and follow-up per discharge timing and clinical context.';
    }
  }
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
  const followupGuidance = generateFollowupGuidance(tsbValue, photoThreshold, ageHours);

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
  const followupGuidance = generateFollowupGuidance(tsbValue, thresholds.photo, ageHours);

  return {
    photoThreshold: thresholds.photo,
    exchangeThreshold: thresholds.exchange,
    deltaToPhoto,
    followupGuidance,
    isCached: false
  };
}

/**
 * Get default bili inputs
 */
export function getDefaultBiliInputs(): BiliInputs {
  const now = new Date();
  const birth = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  return {
    gestationalAgeWeeks: 39,
    gestationalAgeDays: 0,
    birthTime: birth.toISOString().slice(0, 16),
    sampleTime: now.toISOString().slice(0, 16),
    ageHours: 24,
    tsbValue: 8.0,
    hasNeurotoxRiskFactors: false
  };
}
