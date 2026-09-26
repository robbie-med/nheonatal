/**
 * Kaiser Permanente Early-Onset Sepsis (EOS) Calculator
 *
 * Implements the KP multivariable logistic regression exactly as KP publishes it:
 *
 *   2017 (original) model — Puopolo KM et al. Pediatrics 2011;128:e1155, with the
 *     sign correction for GBS-unknown and the incidence-specific intercepts from
 *     https://neonatalsepsiscalculator.kaiserpermanente.org/EmrFAQ.aspx
 *   2024 (updated) model — Kuzniewicz MW et al. Pediatrics 2024;154(4):e2023065267,
 *     coefficients and intercept table from
 *     https://neonatalsepsiscalculator.kaiserpermanente.org/ModelUpdateFAQ.aspx
 *
 *   logit = intercept(incidence)
 *         + b_temp * TempF
 *         + b_ga * GA + b_ga2 * GA^2          (GA in exact weeks: weeks + days/7)
 *         + b_rom * (ROM_h + 0.05)^0.2
 *         + b_abx1 * [GBS IAP >=2h, or broad-spectrum 2-3.9h]
 *         + b_abx2 * [broad-spectrum >=4h]
 *         + b_gbs_pos * [GBS+] + b_gbs_unk * [GBS unknown]
 *   risk at birth = 1 / (1 + exp(-logit))
 *   posterior odds = prior odds * LR(clinical exam)
 *
 * The intercepts are the exact values KP's web calculator submits for each
 * incidence in its dropdown. With them this module reproduces every value in
 * kp-eos-data.csv to the displayed 0.01/1000 (see eos.test.ts).
 */

import { EOSInputs, EOSOutputs, EOSModelVersion } from '../types';

interface EOSModel {
  beta_temp_perF: number;
  beta_ga: number;
  beta_ga_sq: number;
  beta_rom: number;
  beta_abx1: number;
  beta_abx2: number;
  beta_gbs_positive: number;
  beta_gbs_unknown: number;
  /** incidence per 1000 live births -> intercept, as submitted by KP's calculator dropdown */
  intercepts: [number, number][];
  lr: { well: number; equivocal: number; ill: number };
  gaMinWeeks: number;
  gaMaxWeeks: number;
}

const MODEL_2017: EOSModel = {
  beta_temp_perF: 0.868,
  beta_ga: -6.9325,
  beta_ga_sq: 0.0877,
  beta_rom: 1.2256,
  beta_abx1: -1.0488,
  beta_abx2: -1.1861,
  beta_gbs_positive: 0.5771,
  beta_gbs_unknown: 0.0427,
  intercepts: [
    [0.1, 38.952265],
    [0.2, 39.646367],
    [0.3, 40.0528],
    [0.4, 40.3415],
    [0.5, 40.5656],
    [0.6, 40.7489],
    [0.7, 40.903919],
    [0.8, 41.0384],
    [0.9, 41.1571],
    [1.0, 41.263432],
    [2.0, 41.965852],
    [4.0, 42.676976],
  ],
  // Upper 95% CI likelihood ratios (Escobar 2014), per KP EMR FAQ
  lr: { well: 0.41, equivocal: 5.0, ill: 21.2 },
  gaMinWeeks: 34,
  gaMaxWeeks: 43,
};

const MODEL_2024: EOSModel = {
  beta_temp_perF: 0.85194656,
  beta_ga: -7.72247124,
  beta_ga_sq: 0.09842383,
  beta_rom: 0.86770862,
  beta_abx1: -2.13142945,
  beta_abx2: -2.33985917,
  beta_gbs_positive: 1.02265353,
  beta_gbs_unknown: 1.13710111,
  intercepts: [
    [0.05, 55.6],
    [0.1, 56.3],
    [0.2, 57.0],
    [0.27, 57.3],
    [0.3, 57.4],
    [0.4, 57.7],
    [0.5, 57.9],
    [0.6, 58.1],
    [0.7, 58.2],
    [0.8, 58.4],
    [0.9, 58.5],
    [1.0, 58.6],
    [2.0, 59.3],
    [4.0, 60.0],
    [5.0, 60.2],
  ],
  // Point-estimate likelihood ratios, per KP 2024 Model Update FAQ
  lr: { well: 0.36, equivocal: 3.65, ill: 14.5 },
  gaMinWeeks: 35,
  gaMaxWeeks: 43,
};

function getModel(version: EOSModelVersion): EOSModel {
  return version === '2024' ? MODEL_2024 : MODEL_2017;
}

/** Incidence options (per 1000 live births) offered by KP's calculator for each model. */
export function getIncidenceOptions(version: EOSModelVersion): number[] {
  return getModel(version).intercepts.map(([inc]) => inc);
}

function logOdds(per1000: number): number {
  const p = per1000 / 1000;
  return Math.log(p / (1 - p));
}

/**
 * Intercept for a baseline incidence. KP's tabulated value is used when the
 * incidence is one KP offers; otherwise the intercept is interpolated (or
 * extrapolated from the nearest pair) linearly in the log-odds of incidence,
 * which is the form of KP's prior-correction adjustment.
 */
function interceptFor(model: EOSModel, incidence: number): number {
  const table = model.intercepts;
  const exact = table.find(([inc]) => Math.abs(inc - incidence) < 1e-9);
  if (exact) return exact[1];

  let i = table.findIndex(([inc]) => inc > incidence);
  if (i <= 0) i = i === 0 ? 1 : table.length - 1;
  const [x0, y0] = table[i - 1];
  const [x1, y1] = table[i];
  const t = (logOdds(incidence) - logOdds(x0)) / (logOdds(x1) - logOdds(x0));
  return y0 + t * (y1 - y0);
}

function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

type AbxCategory = 'none' | 'abx1' | 'abx2';

/**
 * Map UI (type, duration) to KP's antibiotic categories.
 *   abx1: GBS-specific IAP >=2h, or broad-spectrum 2-3.9h
 *   abx2: broad-spectrum >=4h
 *   none: no antibiotics, or any antibiotics <2h
 */
function mapAntibiotics(
  type: EOSInputs['antibioticType'],
  duration: EOSInputs['antibioticDuration']
): AbxCategory {
  if (type === 'none' || duration === 'none' || duration === 'lessThan2h') {
    return 'none';
  }
  if (type === 'broadSpectrum' && duration === 'greaterThan4h') {
    return 'abx2';
  }
  return 'abx1';
}

function computeLogit(inputs: EOSInputs, m: EOSModel): number {
  const tempF = celsiusToFahrenheit(inputs.maternalTempC);
  const ga = inputs.gestationalAgeWeeks + inputs.gestationalAgeDays / 7;

  let logit = interceptFor(m, inputs.baselineIncidence);
  logit += m.beta_temp_perF * tempF;
  logit += m.beta_ga * ga + m.beta_ga_sq * ga * ga;
  logit += m.beta_rom * Math.pow(Math.max(inputs.romHours, 0) + 0.05, 0.2);

  const abx = mapAntibiotics(inputs.antibioticType, inputs.antibioticDuration);
  if (abx === 'abx1') logit += m.beta_abx1;
  else if (abx === 'abx2') logit += m.beta_abx2;

  if (inputs.gbsStatus === 'positive') logit += m.beta_gbs_positive;
  else if (inputs.gbsStatus === 'unknown') logit += m.beta_gbs_unknown;

  return logit;
}

function logitToPer1000(logit: number): number {
  return 1000 / (1 + Math.exp(-logit));
}

function applyLikelihoodRatio(priorPer1000: number, lr: number): number {
  const priorOdds = priorPer1000 / (1000 - priorPer1000);
  const posteriorOdds = priorOdds * lr;
  return (posteriorOdds / (1 + posteriorOdds)) * 1000;
}

// ============================================================================
// RECOMMENDATIONS
// Mirrors the KP web calculator's output (verified against live KP results):
//   Clinical illness: posterior >=3 "Empiric antibiotics", else "Consider starting
//     empiric antibiotics"; vitals per NICU.
//   Well / equivocal: posterior >=3 empiric antibiotics (vitals per NICU);
//     1-2.99 blood culture (vitals q4h x24h); <1 no culture, no antibiotics,
//     with vitals q4h x24h if risk at birth >=1, otherwise routine vitals.
// Compared on the values as displayed (rounded to 0.01/1000).
// ============================================================================

const CULTURE_MIN = 1;
const EMPIRIC_MIN = 3;
const ENHANCED_VITALS_BIRTH_MIN = 1;

function getRecommendation(
  exam: EOSInputs['clinicalExam'],
  riskAtBirth: number,
  riskPosterior: number
): { code: EOSOutputs['recommendationCode']; text: string } {
  if (exam === 'ill') {
    return riskPosterior >= EMPIRIC_MIN
      ? { code: 'empiric', text: 'Empiric antibiotics. Vitals per NICU.' }
      : { code: 'empiric', text: 'Consider starting empiric antibiotics. Vitals per NICU.' };
  }
  if (riskPosterior >= EMPIRIC_MIN) {
    return { code: 'empiric', text: 'Empiric antibiotics. Vitals per NICU.' };
  }
  if (riskPosterior >= CULTURE_MIN) {
    return { code: 'labs', text: 'Blood culture. Vitals every 4 hours for 24 hours.' };
  }
  if (riskAtBirth >= ENHANCED_VITALS_BIRTH_MIN) {
    return { code: 'enhanced', text: 'No culture, no antibiotics. Vitals every 4 hours for 24 hours.' };
  }
  return { code: 'routine', text: 'No culture, no antibiotics. Routine vitals.' };
}

// ============================================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================================

export function calculateEOS(inputs: EOSInputs): EOSOutputs {
  const model = getModel(inputs.modelVersion);
  const riskAtBirthRaw = logitToPer1000(computeLogit(inputs, model));
  const riskPosteriorRaw = applyLikelihoodRatio(riskAtBirthRaw, model.lr[inputs.clinicalExam]);
  const riskAtBirth = Math.round(riskAtBirthRaw * 100) / 100;
  const riskPosterior = Math.round(riskPosteriorRaw * 100) / 100;
  const recommendation = getRecommendation(inputs.clinicalExam, riskAtBirth, riskPosterior);

  const ga = inputs.gestationalAgeWeeks + inputs.gestationalAgeDays / 7;
  const outOfRange = ga < model.gaMinWeeks || ga >= model.gaMaxWeeks + 1;
  const text = outOfRange
    ? `GA outside ${inputs.modelVersion} KP model range (${model.gaMinWeeks}-${model.gaMaxWeeks}w): risk estimate not valid. ${recommendation.text}`
    : recommendation.text;

  return {
    riskAtBirth,
    riskPosterior,
    recommendationCode: recommendation.code,
    recommendationText: text,
  };
}

export function getDefaultEOSInputs(baselineIncidence = 0.5): EOSInputs {
  return {
    modelVersion: '2024',
    gestationalAgeWeeks: 39,
    gestationalAgeDays: 0,
    maternalTempC: 37.0,
    romHours: 0,
    gbsStatus: 'unknown',
    antibioticType: 'none',
    antibioticDuration: 'none',
    clinicalExam: 'well',
    baselineIncidence,
  };
}

export function getModelInfo(version: EOSModelVersion): {
  name: string;
  year: number;
  description: string;
  gbsNote: string;
  reference: string;
  methodology: string;
} {
  if (version === '2024') {
    return {
      name: 'Updated Model',
      year: 2024,
      description: 'Modern cohort with universal GBS screening',
      gbsNote: 'GBS Unknown OR ≈ 3.1 — significant risk when status unknown',
      reference: 'Kuzniewicz et al., Pediatrics 2024',
      methodology: 'Cohort-based',
    };
  }
  return {
    name: 'Original Model',
    year: 2017,
    description: 'Nested case-control design',
    gbsNote: 'GBS Unknown OR ≈ 1.0 — minimal effect when status unknown',
    reference: 'Kuzniewicz et al., JAMA Pediatrics 2017',
    methodology: 'Case-control',
  };
}

export const CLINICAL_PRESENTATION_DEFINITIONS = {
  well: {
    title: 'Well Appearing',
    criteria: [
      'Normal vital signs and physical exam',
      'No respiratory support needed',
      'No NICU evaluation required',
    ],
  },
  equivocal: {
    title: 'Equivocal',
    criteria: [
      'Transient need for CPAP/oxygen in delivery room',
      'Mild respiratory distress that improves',
      'Mild temperature instability',
    ],
  },
  ill: {
    title: 'Clinical Illness',
    criteria: [
      'Persistent respiratory support needed',
      'Hemodynamic instability',
      'Severe respiratory distress',
      'Persistent temperature instability',
    ],
  },
};

export const MODEL_SELECTION_GUIDANCE = {
  title: 'Which Model Should I Use?',
  recommendation2024: {
    when: 'Universal GBS screening is performed (most US hospitals)',
    rationale: 'GBS Unknown status is rare and clinically significant (OR ≈ 3.1)',
    note: 'This is the default for most US institutions with standard prenatal care.',
  },
  recommendation2017: {
    when: 'Universal GBS screening is NOT performed',
    rationale: 'GBS Unknown status is common and near-neutral (OR ≈ 1.0)',
    note: 'Consider for settings without universal screening or limited prenatal care.',
  },
  keyDifference: 'GBS Unknown: 2017 OR≈1.0 vs 2024 OR≈3.1',
  citation: 'Kuzniewicz MW, et al. JAMA Pediatr. 2017; Kuzniewicz MW, et al. Pediatrics. 2024',
};

export const TECHNICAL_VARIANCE_NOTE = `
This calculator implements the Kaiser Permanente EOS logistic regression using
the coefficients, incidence-specific intercepts and likelihood ratios KP
publishes on its EMR FAQ (2017 model) and 2024 Model Update FAQ pages.
It reproduces every scraped KP web-calculator output in the test set to the
displayed 0.01/1000.

KEY MODEL DIFFERENCES:
• GBS Unknown: 2017 OR≈1.0 vs 2024 OR≈3.1
• Clinical Illness LR: 2017 = 21.2 vs 2024 = 14.5
• Well Appearing LR: 2017 = 0.41 vs 2024 = 0.36

Use as a supplemental tool alongside clinical judgment.
`.trim();
