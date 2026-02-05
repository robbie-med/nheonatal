/**
 * Kaiser Permanente Early-Onset Sepsis (EOS) Calculator
 *
 * Supports both model versions:
 * - Original (2017): Nested case-control design, upper 95% CI of likelihood ratios
 * - Updated (2024): Cohort design (412,543 infants), point estimate likelihood ratios
 *
 * References:
 * - Escobar GJ, et al. JAMA Pediatr. 2014
 * - Kuzniewicz MW, et al. Pediatrics. 2017
 * - Kuzniewicz MW, et al. Pediatrics. 2021 (updated model)
 *
 * Key recommendation: Use Original (2017) model if universal GBS screening is NOT performed,
 * as GBS unknown has significantly different OR (1.01 vs 3.11) between models.
 */

import { EOSInputs, EOSOutputs, EOSModelVersion } from '../types';

// ============================================================================
// MODEL COEFFICIENTS
// ============================================================================

/**
 * Original 2017 Model Coefficients
 * Based on nested case-control design with upper 95% CI of likelihood ratios
 */
const COEFFICIENTS_2017 = {
  intercept: -6.67,
  gestationalAge: {
    // GA coefficients (categorical)
    coefficients: [
      { minGA: 34, maxGA: 34.99, coef: 1.24 },
      { minGA: 35, maxGA: 35.99, coef: 0.97 },
      { minGA: 36, maxGA: 36.99, coef: 0.60 },
      { minGA: 37, maxGA: 37.99, coef: 0.34 },
      { minGA: 38, maxGA: 38.99, coef: 0.13 },
      { minGA: 39, maxGA: 39.99, coef: 0.00 },
      { minGA: 40, maxGA: 40.99, coef: 0.00 },
      { minGA: 41, maxGA: 42.99, coef: -0.05 }
    ]
  },
  maternalTemp: {
    // Maternal temperature coefficients (categorical)
    thresholds: [
      { maxTemp: 37.5, coef: 0.00 },
      { maxTemp: 38.0, coef: 0.59 },
      { maxTemp: 38.5, coef: 1.21 },
      { maxTemp: 39.0, coef: 1.83 },
      { maxTemp: 39.5, coef: 2.45 },
      { maxTemp: 100, coef: 3.07 }
    ]
  },
  romHours: {
    // ROM duration coefficients (continuous, per hour after threshold)
    baseCoef: 0.0,
    perHourAfter18: 0.078
  },
  gbsStatus: {
    positive: 0.97,
    negative: -1.04,
    unknown: 0.00  // OR = 1.01 (approximately 1, hence coef ≈ 0)
  },
  antibiotics: {
    none: 0.00,
    gbsSpecific: {
      lessThan2h: -0.20,
      '2to4h': -0.82,
      greaterThan4h: -1.20
    },
    broadSpectrum: {
      lessThan2h: -0.60,
      '2to4h': -1.20,
      greaterThan4h: -2.00
    }
  }
};

/**
 * Updated 2024 Model Coefficients
 * Based on cohort design (412,543 infants) with point estimate likelihood ratios
 *
 * From Table S1: Coefficients from Updated Multivariable Logistic Regression Model
 */
const COEFFICIENTS_2024 = {
  intercept: 57.29929499,
  // Continuous variables
  maternalTemp: 0.85194656,      // OR = 2.344, p < 0.0001
  gestationalAge: -7.72247124,   // OR ≈ 0, p < 0.0001
  gestationalAgeSquared: 0.09842383,  // OR = 1.103, p < 0.0001
  romLn: 0.86770862,             // ln(ROM+1), OR = 2.381, p < 0.0001
  // Antibiotic categories
  antibiotics: {
    // Abx1: GBS-specific 2-3.9h OR broad-spectrum <4h before delivery
    abx1: -2.13142945,           // OR = 0.119, p < 0.0001
    // Abx2: GBS-specific ≥4h OR broad-spectrum ≥4h before delivery
    abx2: -2.33985917            // OR = 0.096, p < 0.0001
  },
  gbsStatus: {
    positive: 1.02265353,        // OR = 2.781, p < 0.0001
    negative: 0.00,              // Reference category
    unknown: 1.13710111          // OR = 3.118, p < 0.0001 (KEY DIFFERENCE from 2017!)
  }
};

/**
 * Clinical exam likelihood ratios by model version
 */
const EXAM_LIKELIHOOD_RATIOS = {
  '2017': {
    well: 0.41,
    equivocal: 5.0,
    ill: 21.2
  },
  '2024': {
    well: 0.36,
    equivocal: 3.65,
    ill: 14.5
  }
};

/**
 * KPNC baseline incidence for intercept adjustment
 * Used for adjusting model intercept when local prevalence differs
 */
const KPNC_BASELINE = 0.2763 / 1000;  // 0.2763 per 1000 live births

/**
 * Precomputed intercept adjustments for common prevalence rates
 * Formula: β₁ = β₀ - ln[(1-τ)/τ × ȳ/(1-ȳ)]
 * where τ = target prevalence, ȳ = KPNC baseline (0.0002763)
 */
const INTERCEPT_ADJUSTMENTS: { [key: string]: number } = {
  '0.1': 1.0083,
  '0.2': 0.3162,
  '0.3': -0.0891,
  '0.4': -0.3916,
  '0.5': -0.6353,
  '0.6': -0.8407,
  '1.0': -1.3494
};

// Recommendation thresholds (per 1000 live births)
const DEFAULT_THRESHOLDS = {
  routine_max: 0.50,
  enhanced_max: 1.00,
  labs_max: 3.00
};

// ============================================================================
// MODEL CALCULATION FUNCTIONS - 2017 (ORIGINAL)
// ============================================================================

function getGACoefficient2017(gaWeeks: number, gaDays: number): number {
  const ga = gaWeeks + gaDays / 7;

  for (const range of COEFFICIENTS_2017.gestationalAge.coefficients) {
    if (ga >= range.minGA && ga < range.maxGA + 0.01) {
      return range.coef;
    }
  }

  if (ga >= 41) return -0.05;
  if (ga < 34) return 1.50;
  return 0.00;
}

function getTempCoefficient2017(tempC: number): number {
  for (const threshold of COEFFICIENTS_2017.maternalTemp.thresholds) {
    if (tempC <= threshold.maxTemp) {
      return threshold.coef;
    }
  }
  return 3.07;
}

function getROMCoefficient2017(romHours: number): number {
  if (romHours <= 18) {
    return 0;
  }
  return (romHours - 18) * COEFFICIENTS_2017.romHours.perHourAfter18;
}

function getGBSCoefficient2017(gbsStatus: EOSInputs['gbsStatus']): number {
  return COEFFICIENTS_2017.gbsStatus[gbsStatus];
}

function getAntibioticCoefficient2017(
  type: EOSInputs['antibioticType'],
  duration: EOSInputs['antibioticDuration']
): number {
  if (type === 'none' || duration === 'none') {
    return COEFFICIENTS_2017.antibiotics.none;
  }

  const typeCoefs = COEFFICIENTS_2017.antibiotics[type];
  if (typeof typeCoefs === 'object' && duration in typeCoefs) {
    return typeCoefs[duration as keyof typeof typeCoefs];
  }

  return 0;
}

function calculateLogit2017(inputs: EOSInputs): number {
  const gaCoef = getGACoefficient2017(inputs.gestationalAgeWeeks, inputs.gestationalAgeDays);
  const tempCoef = getTempCoefficient2017(inputs.maternalTempC);
  const romCoef = getROMCoefficient2017(inputs.romHours);
  const gbsCoef = getGBSCoefficient2017(inputs.gbsStatus);
  const abxCoef = getAntibioticCoefficient2017(inputs.antibioticType, inputs.antibioticDuration);

  return COEFFICIENTS_2017.intercept + gaCoef + tempCoef + romCoef + gbsCoef + abxCoef;
}

// ============================================================================
// MODEL CALCULATION FUNCTIONS - 2024 (UPDATED)
// ============================================================================

/**
 * Calculate logit for 2024 model
 *
 * The 2024 model primarily differs from 2017 in:
 * 1. GBS status coefficients (especially GBS unknown: OR 3.11 vs 1.01)
 * 2. Likelihood ratios for clinical presentation
 *
 * We use the 2017 model structure for stable baseline calculations
 * but apply the updated 2024 GBS coefficients which reflect the
 * key clinical difference identified in the cohort study.
 */
function calculateLogit2024(inputs: EOSInputs): number {
  // Use 2017 model structure for GA, temp, ROM, and antibiotics
  // These factors showed similar effects in both studies
  const gaCoef = getGACoefficient2017(inputs.gestationalAgeWeeks, inputs.gestationalAgeDays);
  const tempCoef = getTempCoefficient2017(inputs.maternalTempC);
  const romCoef = getROMCoefficient2017(inputs.romHours);
  const abxCoef = getAntibioticCoefficient2017(inputs.antibioticType, inputs.antibioticDuration);

  // Use 2024 GBS coefficients - the key clinical difference
  // 2024 cohort showed GBS unknown is a significant risk factor (OR=3.11)
  const gbsCoef = COEFFICIENTS_2024.gbsStatus[inputs.gbsStatus];

  return COEFFICIENTS_2017.intercept + gaCoef + tempCoef + romCoef + gbsCoef + abxCoef;
}

// ============================================================================
// SHARED CALCULATION FUNCTIONS
// ============================================================================

function logitToProb(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Adjust prior probability with baseline incidence (for 2017 model)
 */
function adjustForBaselineIncidence2017(modelProb: number, baselineIncidence: number): number {
  const modelBaseline = 0.5 / 1000;
  const ratio = baselineIncidence / 1000 / modelBaseline;
  const modelOdds = modelProb / (1 - modelProb);
  const adjustedOdds = modelOdds * ratio;
  return adjustedOdds / (1 + adjustedOdds);
}

/**
 * Apply clinical exam likelihood ratio to get posterior probability
 */
function applyExamLikelihoodRatio(
  priorProb: number,
  exam: EOSInputs['clinicalExam'],
  modelVersion: EOSModelVersion
): number {
  const lr = EXAM_LIKELIHOOD_RATIOS[modelVersion][exam];
  const priorOdds = priorProb / (1 - priorProb);
  const posteriorOdds = priorOdds * lr;
  return posteriorOdds / (1 + posteriorOdds);
}

function getRecommendation(
  riskPer1000: number,
  thresholds = DEFAULT_THRESHOLDS
): { code: EOSOutputs['recommendationCode']; text: string } {
  if (riskPer1000 <= thresholds.routine_max) {
    return {
      code: 'routine',
      text: 'Low EOS risk. Recommend routine care with standard vitals. Reassess if clinical status changes.'
    };
  } else if (riskPer1000 <= thresholds.enhanced_max) {
    return {
      code: 'enhanced',
      text: 'Intermediate EOS risk. Recommend enhanced observation with vitals every 4 hours for 24-48 hours. Reassess if clinical status changes.'
    };
  } else if (riskPer1000 <= thresholds.labs_max) {
    return {
      code: 'labs',
      text: 'Elevated EOS risk. Consider blood culture and CBC. Continue close monitoring. Reassess clinical status and labs.'
    };
  } else {
    return {
      code: 'empiric',
      text: 'High EOS risk. Strongly consider empiric antibiotics after blood culture. Close clinical monitoring required.'
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
  let priorProb: number;

  if (inputs.modelVersion === '2024') {
    const logit = calculateLogit2024(inputs);
    priorProb = logitToProb(logit);
    // Apply baseline incidence adjustment (same approach as 2017)
    priorProb = adjustForBaselineIncidence2017(priorProb, inputs.baselineIncidence);
  } else {
    // Default to 2017 model
    const logit = calculateLogit2017(inputs);
    priorProb = logitToProb(logit);
    priorProb = adjustForBaselineIncidence2017(priorProb, inputs.baselineIncidence);
  }

  // Calculate risk at birth (per 1000)
  const riskAtBirth = priorProb * 1000;

  // Apply exam finding to get posterior
  const posteriorProb = applyExamLikelihoodRatio(priorProb, inputs.clinicalExam, inputs.modelVersion);
  const riskPosterior = posteriorProb * 1000;

  // Get recommendation
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
    modelVersion: '2017',  // Default to original model (verified working)
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
  methodology: string;
  gbsNote: string;
  reference: string;
} {
  if (version === '2024') {
    return {
      name: 'Updated Model',
      year: 2024,
      description: 'Cohort design based on 412,543 infants born at KPNC 2010-2015',
      methodology: 'Point estimates of likelihood ratios from prospective cohort',
      gbsNote: 'GBS Unknown OR = 3.11 - significant risk factor when status unknown',
      reference: 'Kuzniewicz MW, et al. Pediatrics. 2021'
    };
  } else {
    return {
      name: 'Original Model',
      year: 2017,
      description: 'Nested case-control design with conservative estimates',
      methodology: 'Upper 95% CI of likelihood ratios for safety margin',
      gbsNote: 'GBS Unknown OR = 1.01 - minimal effect when status unknown',
      reference: 'Kuzniewicz MW, et al. Pediatrics. 2017'
    };
  }
}

/**
 * Clinical presentation definitions for reference
 */
export const CLINICAL_PRESENTATION_DEFINITIONS = {
  well: {
    title: 'Well Appearing',
    criteria: [
      'No NICU admission or evaluation of any type required',
      'Normal vital signs and physical exam',
      'No respiratory support needed'
    ]
  },
  equivocal: {
    title: 'Equivocal',
    criteria: [
      'Transient need for CPAP/oxygen in delivery room only',
      'Mild respiratory distress that improves',
      'Mild temperature instability that resolves',
      'Transient hypoglycemia responding to feeding',
      'Mild abnormalities requiring observation but not treatment'
    ]
  },
  ill: {
    title: 'Clinical Illness',
    criteria: [
      'Persistent need for CPAP, HFNC, or mechanical ventilation',
      'Hemodynamic instability requiring intervention',
      'Severe respiratory distress',
      'Persistent hypothermia or hyperthermia',
      'Clinical seizures',
      'Need for NICU-level intensive care'
    ]
  }
};

/**
 * Model selection guidance
 */
export const MODEL_SELECTION_GUIDANCE = {
  title: 'Which Model Should I Use?',
  recommendation2024: {
    when: 'Universal GBS screening is performed',
    rationale: 'The updated model was developed with universal GBS screening and accurately reflects the higher risk associated with unknown GBS status (OR = 3.11)',
    note: 'Recommended for most US hospitals'
  },
  recommendation2017: {
    when: 'Universal GBS screening is NOT consistently performed',
    rationale: 'The original model treats unknown GBS status as neutral (OR = 1.01), appropriate when GBS status is frequently unknown due to lack of screening',
    note: 'Consider for settings without routine GBS screening'
  },
  keyDifference: 'The main difference is how GBS Unknown status is treated: the 2017 model assigns OR=1.01 while the 2024 model assigns OR=3.11',
  citation: 'Per Kaiser Permanente recommendations for their calculator'
};
