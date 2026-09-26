/**
 * AAP 2022 Hyperbilirubinemia Calculator
 * Uses complete hour-by-hour AAP 2022 threshold data (see biliThresholds.ts).
 */

import { BiliInputs, BiliOutputs } from '../types';
import { getPhotoThreshold, getExchangeThreshold } from './biliThresholds';

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
 * Calculate bili thresholds and guidance from the local AAP 2022 tables
 */
export function calculateBili(inputs: BiliInputs): BiliOutputs {
  const { gestationalAgeWeeks, ageHours, tsbValue, hasNeurotoxRiskFactors } = inputs;

  const photoThreshold = getPhotoThreshold(gestationalAgeWeeks, ageHours, hasNeurotoxRiskFactors);
  const exchangeThreshold = getExchangeThreshold(gestationalAgeWeeks, ageHours, hasNeurotoxRiskFactors);

  const deltaToPhoto = Math.round((tsbValue - photoThreshold) * 10) / 10;
  const followupGuidance = generateFollowupGuidance(tsbValue, photoThreshold, exchangeThreshold, ageHours, gestationalAgeWeeks);

  return {
    photoThreshold,
    exchangeThreshold,
    deltaToPhoto,
    followupGuidance,
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
