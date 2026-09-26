/**
 * Bilirubin thresholds — parity with PediTools bili2022 (AAP 2022).
 *
 * fixtures/peditools-bili2022.json holds phototherapy and exchange thresholds
 * returned by the PediTools API across every GA (35-40w), both risk groups and
 * ages 1-335h.
 */

import { describe, it, expect } from 'vitest';
import reference from './fixtures/peditools-bili2022.json';
import { getPhotoThreshold, getExchangeThreshold } from './biliThresholds';
import { calculateBili } from './bili';

type Row = [string, number, number, number, number];

describe('AAP 2022 thresholds match PediTools', () => {
  for (const [risk, ga, age, photo, exchange] of reference.rows as Row[]) {
    it(`GA ${ga}w, ${age}h, risk=${risk}: photo ${photo}, exchange ${exchange}`, () => {
      const hasRisk = risk === 'any';
      expect(getPhotoThreshold(ga, age, hasRisk)).toBe(photo);
      expect(getExchangeThreshold(ga, age, hasRisk)).toBe(exchange);
    });
  }

  it('rounds fractional age to the nearest hour', () => {
    // PediTools: 40w, no risk, 12h -> 11.1; 13h -> 11.3
    expect(getPhotoThreshold(40, 12.4, false)).toBe(11.1);
    expect(getPhotoThreshold(40, 12.6, false)).toBe(11.3);
  });

  it('clamps ages below 1h to hour 1 and above 336h to hour 336', () => {
    expect(getPhotoThreshold(40, 0, false)).toBe(getPhotoThreshold(40, 1, false));
    expect(getPhotoThreshold(35, 400, false)).toBe(getPhotoThreshold(35, 336, false));
  });
});

describe('AAP 2022 guidance', () => {
  const base = {
    gestationalAgeWeeks: 40,
    gestationalAgeDays: 0,
    birthTime: '',
    sampleTime: '',
    hasNeurotoxRiskFactors: false,
  };

  it('escalation of care at exchange - 2', () => {
    // 40w 48h: photo 17.0, exchange 24.0
    const r = calculateBili({ ...base, ageHours: 48, tsbValue: 22.5 });
    expect(r.followupGuidance).toMatch(/escalation-of-care/);
  });

  it('within 2 of phototherapy threshold before 24h: delay discharge', () => {
    // 40w 12h: photo 11.1
    const r = calculateBili({ ...base, ageHours: 12, tsbValue: 10 });
    expect(r.followupGuidance).toMatch(/Delay discharge/);
  });

  it('>=7 below threshold after 72h: clinical judgment', () => {
    // 40w 80h: photo 20.6
    const r = calculateBili({ ...base, ageHours: 80, tsbValue: 13 });
    expect(r.followupGuidance).toMatch(/clinical judgment/);
  });
});
