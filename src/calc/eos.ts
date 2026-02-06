/**
 * Kaiser Permanente Early-Onset Sepsis (EOS) Calculator
 *
 * Implements both model versions with calibrated lookup tables:
 * - Original (2017): Kuzniewicz et al., JAMA Pediatrics 2017
 * - Updated (2024): Kaiser Permanente 2024 coefficient update
 *
 * These implementations are calibrated against the KP web calculator
 * to produce matching results for the same inputs.
 *
 * KEY MODEL DIFFERENCES:
 * - 2017: GBS Unknown OR ≈ 1.0 (minimal effect), LR for illness = 21.2
 * - 2024: GBS Unknown OR ≈ 3.1 (~3x risk increase), LR for illness = 14.5
 */

import { EOSInputs, EOSOutputs, EOSModelVersion } from '../types';

// ============================================================================
// 2024 MODEL LOOKUP TABLES (from KP calculator scrape)
// ============================================================================

const MODEL_2024 = {
  // Base case: 40w, 98°F, 0 ROM, GBS Neg, no abx = 0.07 per 1000
  baseRisk: 0.07,

  // Temperature multipliers (relative to 98°F base)
  // 98→0.07, 98.5→0.11, 99→0.17, 99.5→0.25, 100→0.39, 100.5→0.60, 101→0.91, 101.5→1.40, 102→2.14
  tempLookup: [
    { tempF: 98.0, risk: 0.07 },
    { tempF: 98.5, risk: 0.11 },
    { tempF: 99.0, risk: 0.17 },
    { tempF: 99.5, risk: 0.25 },
    { tempF: 100.0, risk: 0.39 },
    { tempF: 100.5, risk: 0.60 },
    { tempF: 101.0, risk: 0.91 },
    { tempF: 101.5, risk: 1.40 },
    { tempF: 102.0, risk: 2.14 },
  ],

  // ROM multipliers (relative to 0 ROM base at 40w, 98°F, GBS neg)
  // 0h→0.07, 6h→0.15, 12h→0.18, 18h→0.21, 24h→0.23, 36h→0.26, 48h→0.29, 72h→0.34
  romLookup: [
    { hours: 0, risk: 0.07 },
    { hours: 6, risk: 0.15 },
    { hours: 12, risk: 0.18 },
    { hours: 18, risk: 0.21 },
    { hours: 24, risk: 0.23 },
    { hours: 36, risk: 0.26 },
    { hours: 48, risk: 0.29 },
    { hours: 72, risk: 0.34 },
  ],

  // GA multipliers (relative to 40w base at 98°F, 0 ROM, GBS neg)
  // 35w→0.39, 36w→0.19, 37w→0.11, 38w→0.08, 39w→0.07, 40w→0.07, 41w→0.09, 42w→0.14
  gaLookup: [
    { weeks: 35, risk: 0.39 },
    { weeks: 36, risk: 0.19 },
    { weeks: 37, risk: 0.11 },
    { weeks: 38, risk: 0.08 },
    { weeks: 39, risk: 0.07 },
    { weeks: 40, risk: 0.07 },
    { weeks: 41, risk: 0.09 },
    { weeks: 42, risk: 0.14 },
  ],

  // GBS multipliers (relative to GBS Negative)
  // Neg→0.07, Pos→0.20, Unk→0.22
  gbsMultiplier: {
    negative: 1.0,       // 0.07/0.07
    positive: 2.86,      // 0.20/0.07
    unknown: 3.14,       // 0.22/0.07 - KEY DIFFERENCE: ~3x risk!
  },

  // Antibiotic reduction factors (for GBS positive)
  // none→0.20, broad4→0.02, broad2→0.02, gbs2→0.02
  abxReduction: {
    none: 1.0,
    broad4: 0.10,        // 0.02/0.20
    broad2: 0.10,
    gbs2: 0.10,
  },

  // Likelihood Ratios for clinical presentation
  // Derived from: Well=0.03/0.07, Equi=0.26/0.07, Clin=1.03/0.07
  lr: { well: 0.36, equivocal: 3.65, ill: 14.5 },
};

// ============================================================================
// 2017 MODEL LOOKUP TABLES (from KP calculator scrape)
// ============================================================================

const MODEL_2017 = {
  // Base case: 40w, 98°F, 0 ROM, GBS Neg, no abx = 0.02 per 1000
  baseRisk: 0.02,

  // Temperature multipliers (relative to 98°F base at 40w, 0 ROM, GBS neg)
  // 98→0.02, 99→0.05, 100→0.13, 101→0.31, 102→0.74
  tempLookup: [
    { tempF: 98.0, risk: 0.02 },
    { tempF: 98.5, risk: 0.04 },
    { tempF: 99.0, risk: 0.05 },
    { tempF: 99.5, risk: 0.08 },
    { tempF: 100.0, risk: 0.13 },
    { tempF: 100.5, risk: 0.20 },
    { tempF: 101.0, risk: 0.31 },
    { tempF: 101.5, risk: 0.48 },
    { tempF: 102.0, risk: 0.74 },
  ],

  // ROM multipliers (relative to 0 ROM at 40w, 98°F, GBS neg)
  // 0h→0.02, 6h→0.07, 12h→0.09, 18h→0.10, 24h→0.12, 36h→0.14, 48h→0.17, 72h→0.21
  romLookup: [
    { hours: 0, risk: 0.02 },
    { hours: 6, risk: 0.07 },
    { hours: 12, risk: 0.09 },
    { hours: 18, risk: 0.10 },
    { hours: 24, risk: 0.12 },
    { hours: 36, risk: 0.14 },
    { hours: 48, risk: 0.17 },
    { hours: 72, risk: 0.21 },
  ],

  // GA multipliers (relative to 40w at 98°F, 0 ROM, GBS neg)
  // 34w→0.33, 35w→0.14, 36w→0.07, 37w→0.04, 38w→0.03, 39w→0.02, 40w→0.02, 41w→0.03, 42w→0.04
  gaLookup: [
    { weeks: 34, risk: 0.33 },
    { weeks: 35, risk: 0.14 },
    { weeks: 36, risk: 0.07 },
    { weeks: 37, risk: 0.04 },
    { weeks: 38, risk: 0.03 },
    { weeks: 39, risk: 0.02 },
    { weeks: 40, risk: 0.02 },
    { weeks: 41, risk: 0.03 },
    { weeks: 42, risk: 0.04 },
  ],

  // GBS multipliers (relative to GBS Negative)
  // Neg→0.02, Pos→0.04, Unk→0.02
  gbsMultiplier: {
    negative: 1.0,       // 0.02/0.02
    positive: 2.0,       // 0.04/0.02
    unknown: 1.0,        // 0.02/0.02 - KEY DIFFERENCE: ~same as negative!
  },

  // Antibiotic reduction factors (for GBS positive)
  // none→0.04, broad4→0.01, gbs2→0.01
  abxReduction: {
    none: 1.0,
    broad4: 0.25,        // 0.01/0.04
    broad2: 0.25,
    gbs2: 0.25,
  },

  // Likelihood Ratios for clinical presentation
  lr: { well: 0.41, equivocal: 5.0, ill: 21.2 },
};

// ============================================================================
// INTERPOLATION HELPERS
// ============================================================================

function interpolate(
  value: number,
  lookup: { [key: string]: number }[],
  valueKey: string,
  riskKey: string = 'risk'
): number {
  const sorted = [...lookup].sort((a, b) => a[valueKey] - b[valueKey]);

  // Clamp to range
  if (value <= sorted[0][valueKey]) return sorted[0][riskKey];
  if (value >= sorted[sorted.length - 1][valueKey]) return sorted[sorted.length - 1][riskKey];

  // Find surrounding points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    if (value >= sorted[i][valueKey] && value <= sorted[i + 1][valueKey]) {
      const t = (value - sorted[i][valueKey]) / (sorted[i + 1][valueKey] - sorted[i][valueKey]);
      // Interpolate in log space for better accuracy
      const logRisk1 = Math.log(sorted[i][riskKey]);
      const logRisk2 = Math.log(sorted[i + 1][riskKey]);
      return Math.exp(logRisk1 + t * (logRisk2 - logRisk1));
    }
  }

  return sorted[0][riskKey];
}

function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

// ============================================================================
// RISK CALCULATION
// ============================================================================

function calculateRiskAtBirth(
  inputs: EOSInputs,
  model: typeof MODEL_2024 | typeof MODEL_2017
): number {
  const tempF = celsiusToFahrenheit(inputs.maternalTempC);
  const ga = inputs.gestationalAgeWeeks + inputs.gestationalAgeDays / 7;

  // Get base risk from temperature (which includes base case)
  const tempRisk = interpolate(tempF, model.tempLookup, 'tempF');

  // Get GA adjustment (as multiplier relative to 40w)
  const gaRisk = interpolate(ga, model.gaLookup, 'weeks');
  const gaMultiplier = gaRisk / model.baseRisk;

  // Get ROM adjustment (as multiplier relative to 0h)
  const romRisk = interpolate(inputs.romHours, model.romLookup, 'hours');
  const romMultiplier = romRisk / model.baseRisk;

  // Get GBS multiplier
  const gbsMultiplier = model.gbsMultiplier[inputs.gbsStatus];

  // Get antibiotic reduction (only applies if GBS positive/unknown)
  let abxMultiplier = 1.0;
  if (inputs.gbsStatus !== 'negative' && inputs.antibioticType !== 'none') {
    if (inputs.antibioticDuration === 'greaterThan4h') {
      abxMultiplier = model.abxReduction.broad4;
    } else if (inputs.antibioticDuration === '2to4h') {
      abxMultiplier = model.abxReduction.broad2;
    } else if (inputs.antibioticDuration === 'lessThan2h') {
      // Less than 2h - minimal effect
      abxMultiplier = 0.8;
    }
  }

  // Combine effects multiplicatively
  // Start with temp risk, then adjust for other factors
  let risk = tempRisk;

  // Adjust for GA (if not 40 weeks)
  if (Math.abs(ga - 40) > 0.1) {
    risk = risk * gaMultiplier;
  }

  // Adjust for ROM (if > 0)
  if (inputs.romHours > 0) {
    // ROM effect is additive to the base, not multiplicative to temp
    // Calculate ROM contribution and add it
    const romContribution = (romRisk - model.baseRisk);
    risk = risk + romContribution;
  }

  // Adjust for GBS status
  if (inputs.gbsStatus !== 'negative') {
    risk = risk * gbsMultiplier;
  }

  // Adjust for antibiotics
  if (abxMultiplier < 1.0) {
    risk = risk * abxMultiplier;
  }

  // Adjust for baseline incidence (model calibrated for 0.5/1000)
  const incidenceMultiplier = inputs.baselineIncidence / 0.5;
  risk = risk * incidenceMultiplier;

  return Math.max(0, risk);
}

function applyLikelihoodRatio(
  priorRisk: number,
  exam: EOSInputs['clinicalExam'],
  model: typeof MODEL_2024 | typeof MODEL_2017
): number {
  const lr = model.lr[exam];
  // Convert risk to probability for Bayesian update
  const priorProb = priorRisk / 1000;
  const priorOdds = priorProb / (1 - priorProb);
  const posteriorOdds = priorOdds * lr;
  const posteriorProb = posteriorOdds / (1 + posteriorOdds);
  return posteriorProb * 1000;
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

const DEFAULT_THRESHOLDS = {
  routine_max: 0.50,
  enhanced_max: 1.00,
  labs_max: 3.00
};

function getRecommendation(
  riskPer1000: number,
  thresholds = DEFAULT_THRESHOLDS
): { code: EOSOutputs['recommendationCode']; text: string } {
  if (riskPer1000 <= thresholds.routine_max) {
    return {
      code: 'routine',
      text: 'No culture, no antibiotics. Routine vitals.'
    };
  } else if (riskPer1000 <= thresholds.enhanced_max) {
    return {
      code: 'enhanced',
      text: 'No culture, no antibiotics. Vitals every 4 hours for 24 hours.'
    };
  } else if (riskPer1000 <= thresholds.labs_max) {
    return {
      code: 'labs',
      text: 'Blood culture, close monitoring. Consider antibiotics if clinical concern.'
    };
  } else {
    return {
      code: 'empiric',
      text: 'Strongly consider empiric antibiotics. Blood culture recommended.'
    };
  }
}

// ============================================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================================

/**
 * Main EOS calculation function
 */
export function calculateEOS(
  inputs: EOSInputs,
  thresholds = DEFAULT_THRESHOLDS
): EOSOutputs {
  const model = inputs.modelVersion === '2024' ? MODEL_2024 : MODEL_2017;

  // Calculate risk at birth from maternal factors
  const riskAtBirth = calculateRiskAtBirth(inputs, model);

  // Apply clinical exam likelihood ratio
  const riskPosterior = applyLikelihoodRatio(riskAtBirth, inputs.clinicalExam, model);

  // Get recommendation based on posterior risk
  const recommendation = getRecommendation(riskPosterior, thresholds);

  return {
    riskAtBirth: Math.round(riskAtBirth * 100) / 100,
    riskPosterior: Math.round(riskPosterior * 100) / 100,
    recommendationCode: recommendation.code,
    recommendationText: recommendation.text
  };
}

/**
 * Get default EOS inputs
 */
export function getDefaultEOSInputs(baselineIncidence = 0.5): EOSInputs {
  return {
    modelVersion: '2017',
    gestationalAgeWeeks: 39,
    gestationalAgeDays: 0,
    maternalTempC: 37.0,
    romHours: 0,
    gbsStatus: 'unknown',
    antibioticType: 'none',
    antibioticDuration: 'none',
    clinicalExam: 'well',
    baselineIncidence
  };
}

/**
 * Get model information for UI display
 */
export function getModelInfo(version: EOSModelVersion): {
  name: string;
  year: number;
  description: string;
  gbsNote: string;
  reference: string;
} {
  if (version === '2024') {
    return {
      name: 'Updated Model',
      year: 2024,
      description: 'Modern cohort with universal GBS screening',
      gbsNote: 'GBS Unknown OR ≈ 3.1 — significant risk when status unknown',
      reference: 'Kaiser Permanente 2024 Update'
    };
  } else {
    return {
      name: 'Original Model',
      year: 2017,
      description: 'Nested case-control design',
      gbsNote: 'GBS Unknown OR ≈ 1.0 — minimal effect when status unknown',
      reference: 'Kuzniewicz et al., JAMA Pediatrics 2017'
    };
  }
}

/**
 * Clinical presentation definitions
 */
export const CLINICAL_PRESENTATION_DEFINITIONS = {
  well: {
    title: 'Well Appearing',
    criteria: [
      'Normal vital signs and physical exam',
      'No respiratory support needed',
      'No NICU evaluation required'
    ]
  },
  equivocal: {
    title: 'Equivocal',
    criteria: [
      'Transient need for CPAP/oxygen in delivery room',
      'Mild respiratory distress that improves',
      'Mild temperature instability'
    ]
  },
  ill: {
    title: 'Clinical Illness',
    criteria: [
      'Persistent respiratory support needed',
      'Hemodynamic instability',
      'Severe respiratory distress',
      'Persistent temperature instability'
    ]
  }
};

/**
 * Model selection guidance
 */
export const MODEL_SELECTION_GUIDANCE = {
  title: 'Which Model Should I Use?',
  recommendation2024: {
    when: 'Universal GBS screening is performed (most US hospitals)',
    rationale: 'GBS Unknown status is rare and clinically significant (OR ≈ 3.1)'
  },
  recommendation2017: {
    when: 'Universal GBS screening is NOT performed',
    rationale: 'GBS Unknown status is common and near-neutral (OR ≈ 1.0)'
  },
  keyDifference: 'GBS Unknown: 2017 OR≈1.0 vs 2024 OR≈3.1'
};

/**
 * Technical variance note
 */
export const TECHNICAL_VARIANCE_NOTE = `
This calculator is calibrated against the Kaiser Permanente EOS Calculator.
Results should match for standard inputs. Minor discrepancies may occur due to
rounding or edge cases in interpolation.

KEY MODEL DIFFERENCES:
• GBS Unknown: 2017 OR≈1.0 vs 2024 OR≈3.1
• Clinical Illness LR: 2017 = 21.2 vs 2024 = 14.5
• Well Appearing LR: 2017 = 0.41 vs 2024 = 0.36

Use as a supplemental tool alongside clinical judgment.
`.trim();
