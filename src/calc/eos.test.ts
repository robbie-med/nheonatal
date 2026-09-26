/**
 * EOS Calculator — KP parity tests.
 *
 * Every row of kp-eos-data.csv (outputs scraped from the KP web calculator)
 * must be reproduced exactly at KP's displayed precision (0.01/1000). The
 * coefficients in eos.ts come from KP's published FAQ pages, not from a fit
 * to this data, so the CSV is an independent check.
 */

import { describe, it, expect } from 'vitest';
import kpCsv from '../../kp-eos-data.csv?raw';
import { calculateEOS, getDefaultEOSInputs, getIncidenceOptions } from './eos';
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

interface KPRow {
  model: EOSModelVersion;
  gaW: number;
  gaD: number;
  tempF: number;
  rom: number;
  gbs: string;
  abx: string;
  inc: number;
  birth: number;
  well: number;
  equi: number;
  ill: number;
}

function parseCsv(text: string): KPRow[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  const idx = (name: string) => cols.indexOf(name);
  return lines.map((line) => {
    const f = line.split(',');
    return {
      model: f[idx('Model')] as EOSModelVersion,
      gaW: Number(f[idx('GA_Weeks')]),
      gaD: Number(f[idx('GA_Days')]),
      tempF: Number(f[idx('Temp_F')]),
      rom: Number(f[idx('ROM_Hours')]),
      gbs: f[idx('GBS_Status')],
      abx: f[idx('Antibiotics')],
      inc: Number(f[idx('Incidence')]),
      birth: Number(f[idx('KP_RiskAtBirth')]),
      well: Number(f[idx('KP_WellAppearing')]),
      equi: Number(f[idx('KP_Equivocal')]),
      ill: Number(f[idx('KP_ClinicalIllness')]),
    };
  });
}

function inputs(c: KPRow, exam: EOSInputs['clinicalExam']): EOSInputs {
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

const KP_ROWS = parseCsv(kpCsv);

describe('EOS calculator — exact KP parity (every scraped row)', () => {
  it('loads the scraped table', () => {
    expect(KP_ROWS.length).toBeGreaterThanOrEqual(59);
  });

  for (const c of KP_ROWS) {
    const label = `${c.model} GA=${c.gaW}w${c.gaD}d T=${c.tempF}F ROM=${c.rom}h GBS=${c.gbs} abx=${c.abx} inc=${c.inc}`;
    it(label, () => {
      expect(calculateEOS(inputs(c, 'well')).riskAtBirth).toBeCloseTo(c.birth, 5);
      expect(calculateEOS(inputs(c, 'well')).riskPosterior).toBeCloseTo(c.well, 5);
      expect(calculateEOS(inputs(c, 'equivocal')).riskPosterior).toBeCloseTo(c.equi, 5);
      expect(calculateEOS(inputs(c, 'ill')).riskPosterior).toBeCloseTo(c.ill, 5);
    });
  }
});

describe('EOS reference case (user-reported KP output)', () => {
  it('39w0d, 37.0°C, ROM 12h, GBS−, no abx, 2024, 0.5/1000 → 0.29 birth; 0.10 / 1.06 / 4.19', () => {
    const base: EOSInputs = {
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
    };
    expect(calculateEOS(base).riskAtBirth).toBe(0.29);
    expect(calculateEOS(base).riskPosterior).toBe(0.1);
    expect(calculateEOS({ ...base, clinicalExam: 'equivocal' }).riskPosterior).toBe(1.06);
    expect(calculateEOS({ ...base, clinicalExam: 'ill' }).riskPosterior).toBe(4.19);
  });
});

describe('EOS recommendations — match KP web calculator output', () => {
  // Recommendation text observed on the live KP calculator (2026-09-26) for these rows.
  const cases: { row: Partial<KPRow>; exam: EOSInputs['clinicalExam']; code: string; text: string }[] = [
    // 2024 40w 98F ROM0 GBS- : birth 0.07, well 0.03, equi 0.26, ill 1.03
    { row: { model: '2024', gaW: 40, tempF: 98, rom: 0, gbs: 'Negative' }, exam: 'well', code: 'routine', text: 'No culture, no antibiotics. Routine vitals.' },
    { row: { model: '2024', gaW: 40, tempF: 98, rom: 0, gbs: 'Negative' }, exam: 'equivocal', code: 'routine', text: 'No culture, no antibiotics. Routine vitals.' },
    { row: { model: '2024', gaW: 40, tempF: 98, rom: 0, gbs: 'Negative' }, exam: 'ill', code: 'empiric', text: 'Consider starting empiric antibiotics. Vitals per NICU.' },
    // 2017 40w 98F ROM0 GBS- : ill 0.49 -> still "consider starting empiric antibiotics"
    { row: { model: '2017', gaW: 40, tempF: 98, rom: 0, gbs: 'Negative' }, exam: 'ill', code: 'empiric', text: 'Consider starting empiric antibiotics. Vitals per NICU.' },
    // 2024 37w 100.5F ROM12 GBS- : birth 2.37, well 0.86 -> vitals q4h because birth risk >= 1
    { row: { model: '2024', gaW: 37, tempF: 100.5, rom: 12, gbs: 'Negative' }, exam: 'well', code: 'enhanced', text: 'No culture, no antibiotics. Vitals every 4 hours for 24 hours.' },
    { row: { model: '2024', gaW: 37, tempF: 100.5, rom: 12, gbs: 'Negative' }, exam: 'equivocal', code: 'empiric', text: 'Empiric antibiotics. Vitals per NICU.' },
    // 2024 38w 100F ROM18 GBS unk : well 1.40 -> blood culture
    { row: { model: '2024', gaW: 38, tempF: 100, rom: 18, gbs: 'Unknown' }, exam: 'well', code: 'labs', text: 'Blood culture. Vitals every 4 hours for 24 hours.' },
    // 2024 40w 98F ROM48 GBS- : equi 1.06 -> blood culture; ill 4.18 -> empiric
    { row: { model: '2024', gaW: 40, tempF: 98, rom: 48, gbs: 'Negative' }, exam: 'equivocal', code: 'labs', text: 'Blood culture. Vitals every 4 hours for 24 hours.' },
    { row: { model: '2024', gaW: 40, tempF: 98, rom: 48, gbs: 'Negative' }, exam: 'ill', code: 'empiric', text: 'Empiric antibiotics. Vitals per NICU.' },
    // 2024 35w 101F ROM24 GBS+ : well 15.82 -> empiric
    { row: { model: '2024', gaW: 35, tempF: 101, rom: 24, gbs: 'Positive' }, exam: 'well', code: 'empiric', text: 'Empiric antibiotics. Vitals per NICU.' },
  ];

  for (const c of cases) {
    const row: KPRow = {
      model: '2024', gaW: 40, gaD: 0, tempF: 98, rom: 0, gbs: 'Negative', abx: 'none', inc: 0.5,
      birth: 0, well: 0, equi: 0, ill: 0, ...c.row,
    };
    it(`${row.model} GA=${row.gaW} T=${row.tempF} ROM=${row.rom} GBS=${row.gbs} ${c.exam} → ${c.code}`, () => {
      const r = calculateEOS(inputs(row, c.exam));
      expect(r.recommendationCode).toBe(c.code);
      expect(r.recommendationText).toBe(c.text);
    });
  }
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
    expect(shortAbx.riskAtBirth).toBe(noAbx.riskAtBirth);
  });

  it('GBS-specific 2-4h and >=4h are the same KP category', () => {
    const base = { ...getDefaultEOSInputs(), gbsStatus: 'positive' as const, antibioticType: 'gbsSpecific' as const, romHours: 18, maternalTempC: 38.5 };
    expect(calculateEOS({ ...base, antibioticDuration: '2to4h' }).riskAtBirth)
      .toBe(calculateEOS({ ...base, antibioticDuration: 'greaterThan4h' }).riskAtBirth);
  });
});

describe('Baseline incidence', () => {
  it('offers exactly the incidences in KP\'s dropdowns', () => {
    expect(getIncidenceOptions('2017')).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 4]);
    expect(getIncidenceOptions('2024')).toEqual([0.05, 0.1, 0.2, 0.27, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 4, 5]);
  });

  it('off-list incidence falls between its neighbours', () => {
    const base = { ...getDefaultEOSInputs(), maternalTempC: 38.5, romHours: 18 };
    const lo = calculateEOS({ ...base, baselineIncidence: 1 }).riskAtBirth;
    const mid = calculateEOS({ ...base, baselineIncidence: 1.5 }).riskAtBirth;
    const hi = calculateEOS({ ...base, baselineIncidence: 2 }).riskAtBirth;
    expect(mid).toBeGreaterThan(lo);
    expect(mid).toBeLessThan(hi);
  });
});

describe('GA range', () => {
  it('flags GA outside the model range', () => {
    const r = calculateEOS({ ...getDefaultEOSInputs(), modelVersion: '2024', gestationalAgeWeeks: 34 });
    expect(r.recommendationText).toMatch(/outside 2024 KP model range/);
    const ok = calculateEOS({ ...getDefaultEOSInputs(), modelVersion: '2017', gestationalAgeWeeks: 34 });
    expect(ok.recommendationText).not.toMatch(/outside/);
  });
});
