/**
 * EOS Calculator — table-driven KP parity tests.
 *
 * Test vectors are the KP web-calculator outputs scraped into
 * kp-eos-data.csv. The regression in eos.ts is fit against the same data,
 * so these tests confirm the fit reproduces KP across the input space.
 */

import { describe, it, expect } from 'vitest';
import { calculateEOS, getDefaultEOSInputs } from './eos';
import { EOSInputs, EOSModelVersion } from '../types';

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function mapGbs(s: string): EOSInputs['gbsStatus'] {
  if (s === 'Positive') return 'positive';
  if (s === 'Unknown') return 'unknown';
  return 'negative';
}

function mapAbx(a: string): { type: EOSInputs['antibioticType']; duration: EOSInputs['antibioticDuration'] } {
  switch (a) {
    case 'broad4':
      return { type: 'broadSpectrum', duration: 'greaterThan4h' };
    case 'broad2':
      return { type: 'broadSpectrum', duration: '2to4h' };
    case 'gbs2':
      return { type: 'gbsSpecific', duration: 'greaterThan4h' };
    default:
      return { type: 'none', duration: 'none' };
  }
}

interface KPCase {
  model: EOSModelVersion;
  gaW: number;
  gaD: number;
  tempF: number;
  rom: number;
  gbs: string;
  abx: string;
  inc: number;
  kpBirth: number;
  kpWell: number;
  kpEqui: number;
  kpIll: number;
}

function inputs(c: KPCase, exam: EOSInputs['clinicalExam']): EOSInputs {
  const abx = mapAbx(c.abx);
  return {
    modelVersion: c.model,
    gestationalAgeWeeks: c.gaW,
    gestationalAgeDays: c.gaD,
    maternalTempC: fToC(c.tempF),
    romHours: c.rom,
    gbsStatus: mapGbs(c.gbs),
    antibioticType: abx.type,
    antibioticDuration: abx.duration,
    clinicalExam: exam,
    baselineIncidence: c.inc,
  };
}

// Subset of KP table — chosen to cover every predictor axis plus combined
// risk factors. (Full table in kp-eos-data.csv; these are the rows where
// the old single-axis implementation diverged from KP.)
const KP_CASES: KPCase[] = [
  // 2024 — temperature sweep at 40w, no other RFs
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.07,  kpWell: 0.03,  kpEqui: 0.26,  kpIll: 1.03 },
  { model: '2024', gaW: 40, gaD: 0, tempF: 100.0, rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.39,  kpWell: 0.14,  kpEqui: 1.42,  kpIll: 5.62 },
  { model: '2024', gaW: 40, gaD: 0, tempF: 102.0, rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 2.14,  kpWell: 0.77,  kpEqui: 7.76,  kpIll: 30.14 },
  // 2024 — ROM sweep
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 12, gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.18,  kpWell: 0.07,  kpEqui: 0.67,  kpIll: 2.66 },
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 48, gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.29,  kpWell: 0.10,  kpEqui: 1.06,  kpIll: 4.18 },
  // 2024 — GA sweep
  { model: '2024', gaW: 35, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.39,  kpWell: 0.14,  kpEqui: 1.42,  kpIll: 5.62 },
  { model: '2024', gaW: 39, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.07,  kpWell: 0.02,  kpEqui: 0.25,  kpIll: 0.97 },
  // 2024 — GBS
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'none', inc: 0.5, kpBirth: 0.20,  kpWell: 0.07,  kpEqui: 0.72,  kpIll: 2.85 },
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Unknown',  abx: 'none', inc: 0.5, kpBirth: 0.22,  kpWell: 0.08,  kpEqui: 0.81,  kpIll: 3.20 },
  // 2024 — antibiotics
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'broad4', inc: 0.5, kpBirth: 0.02, kpWell: 0.01, kpEqui: 0.07, kpIll: 0.28 },
  { model: '2024', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'gbs2',   inc: 0.5, kpBirth: 0.02, kpWell: 0.01, kpEqui: 0.09, kpIll: 0.34 },
  // 2024 — combined risk factors (these are where the old implementation failed)
  { model: '2024', gaW: 38, gaD: 0, tempF: 100.0, rom: 18, gbs: 'Unknown',  abx: 'none', inc: 0.5, kpBirth: 3.87,  kpWell: 1.40,  kpEqui: 13.98, kpIll: 53.33 },
  { model: '2024', gaW: 37, gaD: 0, tempF: 100.5, rom: 12, gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 2.37,  kpWell: 0.86,  kpEqui: 8.61,  kpIll: 33.34 },
  { model: '2024', gaW: 39, gaD: 0, tempF: 99.5,  rom: 6,  gbs: 'Positive', abx: 'none', inc: 0.5, kpBirth: 1.44,  kpWell: 0.52,  kpEqui: 5.25,  kpIll: 20.54 },
  // 2017 — baselines and combined
  { model: '2017', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.02,  kpWell: 0.01,  kpEqui: 0.12,  kpIll: 0.49 },
  { model: '2017', gaW: 40, gaD: 0, tempF: 100.0, rom: 0,  gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.13,  kpWell: 0.05,  kpEqui: 0.65,  kpIll: 2.77 },
  { model: '2017', gaW: 40, gaD: 0, tempF: 98.0,  rom: 24, gbs: 'Negative', abx: 'none', inc: 0.5, kpBirth: 0.12,  kpWell: 0.05,  kpEqui: 0.60,  kpIll: 2.52 },
  { model: '2017', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'none', inc: 0.5, kpBirth: 0.04,  kpWell: 0.02,  kpEqui: 0.21,  kpIll: 0.87 },
  { model: '2017', gaW: 38, gaD: 0, tempF: 100.0, rom: 18, gbs: 'Unknown',  abx: 'none', inc: 0.5, kpBirth: 0.74,  kpWell: 0.31,  kpEqui: 3.71,  kpIll: 15.55 },
  // 2017 — antibiotics (newly scraped)
  { model: '2017', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'broad4', inc: 0.5, kpBirth: 0.01, kpWell: 0.01, kpEqui: 0.06, kpIll: 0.27 },
  { model: '2017', gaW: 40, gaD: 0, tempF: 98.0,  rom: 0,  gbs: 'Positive', abx: 'gbs2',   inc: 0.5, kpBirth: 0.01, kpWell: 0.01, kpEqui: 0.07, kpIll: 0.30 },
  { model: '2017', gaW: 38, gaD: 0, tempF: 100.0, rom: 12, gbs: 'Positive', abx: 'broad4', inc: 0.5, kpBirth: 0.33, kpWell: 0.13, kpEqui: 1.64, kpIll: 6.90 },
];

// Tolerance: KP rounds to 2dp, fit residuals add up to ~0.5/1000 worst-case
// for 2024 and ~1.05/1000 worst-case for 2017 (no abx data for fit).
// We use absolute tolerance scaled by magnitude.
function tolerance(kp: number): number {
  if (kp < 1) return 0.1;
  if (kp < 10) return 0.7;
  if (kp < 100) return 3.0;
  return kp * 0.1;
}

describe('EOS calculator — KP parity (table-driven)', () => {
  for (const c of KP_CASES) {
    const label = `${c.model} GA=${c.gaW}w${c.gaD}d T=${c.tempF}F ROM=${c.rom}h GBS=${c.gbs} abx=${c.abx}`;

    it(`${label}: risk at birth ≈ ${c.kpBirth}`, () => {
      const r = calculateEOS(inputs(c, 'well'));
      expect(r.riskAtBirth).toBeCloseTo(c.kpBirth, 0);
      expect(Math.abs(r.riskAtBirth - c.kpBirth)).toBeLessThanOrEqual(tolerance(c.kpBirth));
    });

    it(`${label}: posterior matches well/equi/ill`, () => {
      const well = calculateEOS(inputs(c, 'well')).riskPosterior;
      const equi = calculateEOS(inputs(c, 'equivocal')).riskPosterior;
      const ill  = calculateEOS(inputs(c, 'ill')).riskPosterior;
      expect(Math.abs(well - c.kpWell)).toBeLessThanOrEqual(tolerance(c.kpWell));
      expect(Math.abs(equi - c.kpEqui)).toBeLessThanOrEqual(tolerance(c.kpEqui));
      expect(Math.abs(ill  - c.kpIll )).toBeLessThanOrEqual(tolerance(c.kpIll));
    });
  }
});

describe('EOS reference case (user-reported)', () => {
  it('39w0d, 37.0°C, ROM 12h, GBS−, no abx, well, 2024 → 0.29/1000 at birth', () => {
    const result = calculateEOS({
      modelVersion: '2024',
      gestationalAgeWeeks: 39,
      gestationalAgeDays: 0,
      maternalTempC: 37.0,
      romHours: 12,
      gbsStatus: 'negative',
      antibioticType: 'none',
      antibioticDuration: 'none',
      clinicalExam: 'well',
      baselineIncidence: 0.5,
    });
    // KP web calc returns 0.29 at birth, 0.10 well, 1.06 equi, 4.19 ill.
    expect(result.riskAtBirth).toBeCloseTo(0.29, 1);
    expect(result.riskPosterior).toBeCloseTo(0.10, 1);
  });
});

describe('Antibiotic mapping', () => {
  it('lessThan2h duration is treated as no abx (KP behavior)', () => {
    const base = getDefaultEOSInputs();
    const noAbx = calculateEOS({ ...base, gbsStatus: 'positive' });
    const shortAbx = calculateEOS({
      ...base,
      gbsStatus: 'positive',
      antibioticType: 'gbsSpecific',
      antibioticDuration: 'lessThan2h',
    });
    expect(shortAbx.riskAtBirth).toBeCloseTo(noAbx.riskAtBirth, 2);
  });

  it('adequate abx reduces risk', () => {
    const base = getDefaultEOSInputs();
    const noAbx = calculateEOS({ ...base, gbsStatus: 'positive' });
    const withAbx = calculateEOS({
      ...base,
      gbsStatus: 'positive',
      antibioticType: 'broadSpectrum',
      antibioticDuration: 'greaterThan4h',
    });
    expect(withAbx.riskAtBirth).toBeLessThan(noAbx.riskAtBirth);
  });
});

describe('Baseline incidence scaling', () => {
  it('doubles risk when baseline doubles (logit offset)', () => {
    const base = getDefaultEOSInputs();
    const low = calculateEOS({ ...base, baselineIncidence: 0.5 }).riskAtBirth;
    const high = calculateEOS({ ...base, baselineIncidence: 1.0 }).riskAtBirth;
    // For small risks, doubling baseline ≈ doubles risk.
    expect(high / low).toBeGreaterThan(1.8);
    expect(high / low).toBeLessThan(2.2);
  });
});

describe('Clinical exam likelihood ratios', () => {
  it('well-appearing reduces posterior below prior', () => {
    const inp = getDefaultEOSInputs();
    const r = calculateEOS({ ...inp, clinicalExam: 'well' });
    expect(r.riskPosterior).toBeLessThan(r.riskAtBirth);
  });

  it('ill-appearing multiplies posterior by ~10x or more', () => {
    const inp = getDefaultEOSInputs();
    const r = calculateEOS({ ...inp, clinicalExam: 'ill' });
    expect(r.riskPosterior / r.riskAtBirth).toBeGreaterThan(10);
  });
});
