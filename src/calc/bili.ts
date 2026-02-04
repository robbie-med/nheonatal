/**
 * AAP 2022 Hyperbilirubinemia Calculator
 * Uses PediTools bili2022 API for threshold calculations
 *
 * API Documentation: https://peditools.org/bili2022/bili2022_api.html
 */

import { BiliInputs, BiliOutputs, BiliApiResponse } from '../types';

const PEDITOOLS_API_BASE = 'https://peditools.org/bili2022/api/';

// Local fallback thresholds (simplified AAP 2022 approximations)
// Used when API is unavailable
const FALLBACK_THRESHOLDS = {
  // Phototherapy thresholds by GA category and age
  // Format: { minGA: number, noRisk: number[], withRisk: number[] }
  // Arrays are thresholds at 24h, 48h, 72h, 96h
  categories: [
    {
      minGA: 38,
      noRisk: [12.0, 15.0, 18.0, 19.0],
      withRisk: [10.0, 13.0, 15.0, 17.0]
    },
    {
      minGA: 35,
      noRisk: [10.0, 13.0, 15.0, 17.0],
      withRisk: [8.0, 11.0, 13.0, 14.0]
    }
  ]
};

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
 * Interpolate threshold based on age
 */
function interpolateThreshold(ageHours: number, thresholds: number[]): number {
  const ages = [24, 48, 72, 96];

  if (ageHours <= ages[0]) {
    // Extrapolate below 24h
    const slope = (thresholds[1] - thresholds[0]) / (ages[1] - ages[0]);
    return Math.max(0, thresholds[0] - slope * (ages[0] - ageHours));
  }

  if (ageHours >= ages[ages.length - 1]) {
    return thresholds[thresholds.length - 1];
  }

  // Find bracketing points and interpolate
  for (let i = 0; i < ages.length - 1; i++) {
    if (ageHours >= ages[i] && ageHours <= ages[i + 1]) {
      const t = (ageHours - ages[i]) / (ages[i + 1] - ages[i]);
      return thresholds[i] + t * (thresholds[i + 1] - thresholds[i]);
    }
  }

  return thresholds[thresholds.length - 1];
}

/**
 * Calculate local fallback thresholds
 */
function calculateFallbackThresholds(
  gaWeeks: number,
  gaDays: number,
  ageHours: number,
  hasRiskFactors: boolean
): { photo: number; exchange: number } {
  const ga = gaToDecimal(gaWeeks, gaDays);

  // Find appropriate category
  let category = FALLBACK_THRESHOLDS.categories[FALLBACK_THRESHOLDS.categories.length - 1];
  for (const cat of FALLBACK_THRESHOLDS.categories) {
    if (ga >= cat.minGA) {
      category = cat;
      break;
    }
  }

  const thresholds = hasRiskFactors ? category.withRisk : category.noRisk;
  const photo = interpolateThreshold(ageHours, thresholds);

  // Exchange is typically ~5 above photo threshold
  const exchange = photo + 5;

  return {
    photo: Math.round(photo * 10) / 10,
    exchange: Math.round(exchange * 10) / 10
  };
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
      // Fall back to local calculation
      const fallback = calculateFallbackThresholds(
        gestationalAgeWeeks,
        gestationalAgeDays,
        ageHours,
        hasNeurotoxRiskFactors
      );
      photoThreshold = fallback.photo;
      exchangeThreshold = fallback.exchange;
      isCached = true;
    }
  } else {
    // Use local calculation
    const fallback = calculateFallbackThresholds(
      gestationalAgeWeeks,
      gestationalAgeDays,
      ageHours,
      hasNeurotoxRiskFactors
    );
    photoThreshold = fallback.photo;
    exchangeThreshold = fallback.exchange;
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
 * Calculate bili synchronously with local thresholds only
 */
export function calculateBiliSync(inputs: BiliInputs): BiliOutputs {
  const { gestationalAgeWeeks, gestationalAgeDays, ageHours, tsbValue, hasNeurotoxRiskFactors } = inputs;

  const fallback = calculateFallbackThresholds(
    gestationalAgeWeeks,
    gestationalAgeDays,
    ageHours,
    hasNeurotoxRiskFactors
  );

  const deltaToPhoto = Math.round((tsbValue - fallback.photo) * 10) / 10;
  const followupGuidance = generateFollowupGuidance(tsbValue, fallback.photo, ageHours);

  return {
    photoThreshold: fallback.photo,
    exchangeThreshold: fallback.exchange,
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
