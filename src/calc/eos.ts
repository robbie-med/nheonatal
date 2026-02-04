/**
 * Kaiser Permanente Early-Onset Sepsis (EOS) Calculator
 *
 * Implementation based on the published logistic regression model from:
 * Escobar GJ, et al. JAMA Pediatr. 2014
 * Kuzniewicz MW, et al. Pediatrics. 2017
 *
 * The model calculates sepsis risk based on maternal and neonatal factors,
 * then adjusts based on clinical examination findings.
 */

import { EOSInputs, EOSOutputs } from '../types';

// Model coefficients (from published literature)
const COEFFICIENTS = {
  intercept: -6.67,
  gestationalAge: {
    // GA coefficients (reference: 40 weeks)
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
    // Maternal temperature coefficients
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
    unknown: 0.00
  },
  antibiotics: {
    // Antibiotics effect based on type and timing
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

// Clinical exam likelihood ratios (to adjust posterior probability)
const EXAM_LIKELIHOOD_RATIOS = {
  well: 0.42,
  equivocal: 7.19,
  ill: 30.0
};

// Recommendation thresholds (per 1000 live births)
const DEFAULT_THRESHOLDS = {
  routine_max: 0.50,
  enhanced_max: 1.00,
  labs_max: 3.00
};

/**
 * Calculate gestational age coefficient
 */
function getGACoefficient(gaWeeks: number, gaDays: number): number {
  const ga = gaWeeks + gaDays / 7;

  for (const range of COEFFICIENTS.gestationalAge.coefficients) {
    if (ga >= range.minGA && ga < range.maxGA + 0.01) {
      return range.coef;
    }
  }

  // Default for GA >= 41
  if (ga >= 41) return -0.05;
  // Default for GA < 34 (extrapolate)
  if (ga < 34) return 1.50;

  return 0.00;
}

/**
 * Calculate maternal temperature coefficient
 */
function getTempCoefficient(tempC: number): number {
  for (const threshold of COEFFICIENTS.maternalTemp.thresholds) {
    if (tempC <= threshold.maxTemp) {
      return threshold.coef;
    }
  }
  return 3.07; // Highest category
}

/**
 * Calculate ROM duration coefficient
 */
function getROMCoefficient(romHours: number): number {
  if (romHours <= 18) {
    return 0;
  }
  return (romHours - 18) * COEFFICIENTS.romHours.perHourAfter18;
}

/**
 * Calculate GBS status coefficient
 */
function getGBSCoefficient(gbsStatus: EOSInputs['gbsStatus']): number {
  return COEFFICIENTS.gbsStatus[gbsStatus];
}

/**
 * Calculate antibiotic coefficient
 */
function getAntibioticCoefficient(
  type: EOSInputs['antibioticType'],
  duration: EOSInputs['antibioticDuration']
): number {
  if (type === 'none' || duration === 'none') {
    return COEFFICIENTS.antibiotics.none;
  }

  const typeCoefs = COEFFICIENTS.antibiotics[type];
  if (typeof typeCoefs === 'object' && duration in typeCoefs) {
    return typeCoefs[duration as keyof typeof typeCoefs];
  }

  return 0;
}

/**
 * Calculate the logit (log-odds) of sepsis
 */
function calculateLogit(inputs: EOSInputs): number {
  const gaCoef = getGACoefficient(inputs.gestationalAgeWeeks, inputs.gestationalAgeDays);
  const tempCoef = getTempCoefficient(inputs.maternalTempC);
  const romCoef = getROMCoefficient(inputs.romHours);
  const gbsCoef = getGBSCoefficient(inputs.gbsStatus);
  const abxCoef = getAntibioticCoefficient(inputs.antibioticType, inputs.antibioticDuration);

  return COEFFICIENTS.intercept + gaCoef + tempCoef + romCoef + gbsCoef + abxCoef;
}

/**
 * Convert logit to probability
 */
function logitToProb(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Adjust prior probability with baseline incidence
 */
function adjustForBaselineIncidence(modelProb: number, baselineIncidence: number): number {
  // The model was calibrated on a population with ~0.5/1000 incidence
  // Adjust for local baseline if different
  const modelBaseline = 0.5 / 1000;
  const ratio = baselineIncidence / 1000 / modelBaseline;

  // Use odds ratio adjustment
  const modelOdds = modelProb / (1 - modelProb);
  const adjustedOdds = modelOdds * ratio;
  return adjustedOdds / (1 + adjustedOdds);
}

/**
 * Apply clinical exam likelihood ratio to get posterior probability
 */
function applyExamLikelihoodRatio(priorProb: number, exam: EOSInputs['clinicalExam']): number {
  const lr = EXAM_LIKELIHOOD_RATIOS[exam];
  const priorOdds = priorProb / (1 - priorProb);
  const posteriorOdds = priorOdds * lr;
  return posteriorOdds / (1 + posteriorOdds);
}

/**
 * Get recommendation based on risk level
 */
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

/**
 * Main EOS calculation function
 */
export function calculateEOS(
  inputs: EOSInputs,
  thresholds = DEFAULT_THRESHOLDS
): EOSOutputs {
  // Calculate model probability
  const logit = calculateLogit(inputs);
  let priorProb = logitToProb(logit);

  // Adjust for baseline incidence
  priorProb = adjustForBaselineIncidence(priorProb, inputs.baselineIncidence);

  // Calculate risk at birth (per 1000)
  const riskAtBirth = priorProb * 1000;

  // Apply exam finding to get posterior
  const posteriorProb = applyExamLikelihoodRatio(priorProb, inputs.clinicalExam);
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
