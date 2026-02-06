/**
 * EOS Calculator Unit Tests
 *
 * Test vectors based on actual KP EOS calculator outputs (scraped data).
 * Tests verify parity with KP calculator behavior.
 */

import { describe, it, expect } from 'vitest';
import { calculateEOS, getDefaultEOSInputs } from './eos';
import { EOSInputs } from '../types';

describe('EOS Calculator', () => {
  describe('Default inputs (low risk case)', () => {
    it('should calculate low risk for well-appearing term infant with no risk factors', () => {
      const inputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 39,
        gestationalAgeDays: 0,
        maternalTempC: 37.0,
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);

      expect(result.riskAtBirth).toBeLessThan(0.5);
      expect(result.riskPosterior).toBeLessThan(0.3);
      expect(result.recommendationCode).toBe('routine');
    });
  });

  describe('Elevated temperature cases', () => {
    it('should increase risk with elevated maternal temperature', () => {
      const baseInputs = getDefaultEOSInputs();

      const normalTemp = calculateEOS({ ...baseInputs, maternalTempC: 37.0 });
      const elevatedTemp = calculateEOS({ ...baseInputs, maternalTempC: 38.5 });

      expect(elevatedTemp.riskAtBirth).toBeGreaterThan(normalTemp.riskAtBirth);
    });

    it('should significantly increase risk with high fever (2024 model)', () => {
      // Using 2024 model which has higher baseline risks
      const inputs: EOSInputs = {
        modelVersion: '2024',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 39.0, // 102.2°F
        romHours: 0,
        gbsStatus: 'unknown',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);

      // 2024 model with high fever and GBS unknown should have elevated risk
      expect(result.riskAtBirth).toBeGreaterThan(1.0);
    });
  });

  describe('ROM duration cases', () => {
    it('should increase risk with prolonged ROM', () => {
      const baseInputs = getDefaultEOSInputs();

      const shortROM = calculateEOS({ ...baseInputs, romHours: 6 });
      const longROM = calculateEOS({ ...baseInputs, romHours: 24 });

      expect(longROM.riskAtBirth).toBeGreaterThan(shortROM.riskAtBirth);
    });

    it('should show gradual ROM effect even for shorter durations', () => {
      // KP data shows ROM does affect risk even below 18h
      const baseInputs: EOSInputs = {
        ...getDefaultEOSInputs(),
        gbsStatus: 'negative'
      };

      const rom0 = calculateEOS({ ...baseInputs, romHours: 0 });
      const rom12 = calculateEOS({ ...baseInputs, romHours: 12 });

      // ROM 12h should be higher than ROM 0h
      expect(rom12.riskAtBirth).toBeGreaterThan(rom0.riskAtBirth);
    });
  });

  describe('GBS status cases', () => {
    it('should increase risk with positive GBS', () => {
      const baseInputs = getDefaultEOSInputs();

      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });
      const gbsPos = calculateEOS({ ...baseInputs, gbsStatus: 'positive' });

      expect(gbsPos.riskAtBirth).toBeGreaterThan(gbsNeg.riskAtBirth);
    });

    it('should show major GBS unknown difference between 2017 and 2024 models', () => {
      // This is THE KEY DIFFERENCE between the models
      const baseInputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.7, // 98°F
        romHours: 0,
        gbsStatus: 'unknown',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result2017 = calculateEOS({ ...baseInputs, modelVersion: '2017' });
      const result2024 = calculateEOS({ ...baseInputs, modelVersion: '2024' });

      // 2024 model should have ~3x higher risk for GBS unknown
      expect(result2024.riskAtBirth / result2017.riskAtBirth).toBeGreaterThan(2.5);
    });

    it('should treat GBS unknown similar to negative in 2017 model', () => {
      // In 2017 model, GBS unknown OR ≈ 1.0
      const baseInputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.7,
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const gbsUnk = calculateEOS({ ...baseInputs, gbsStatus: 'unknown' });
      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });

      // Should be very close in 2017 model
      expect(Math.abs(gbsUnk.riskAtBirth - gbsNeg.riskAtBirth)).toBeLessThan(0.02);
    });
  });

  describe('Antibiotic effects', () => {
    it('should decrease risk with adequate antibiotics', () => {
      const inputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 39,
        gestationalAgeDays: 0,
        maternalTempC: 37.0,
        romHours: 0,
        gbsStatus: 'positive',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const noAbx = calculateEOS(inputs);
      const withAbx = calculateEOS({
        ...inputs,
        antibioticType: 'gbsSpecific',
        antibioticDuration: 'greaterThan4h'
      });

      expect(withAbx.riskAtBirth).toBeLessThan(noAbx.riskAtBirth);
    });

    it('should have reduced risk with adequate antibiotic duration', () => {
      const baseInputs: EOSInputs = {
        ...getDefaultEOSInputs(),
        gbsStatus: 'positive',
        antibioticType: 'gbsSpecific'
      };

      const short = calculateEOS({ ...baseInputs, antibioticDuration: 'lessThan2h' });
      const long = calculateEOS({ ...baseInputs, antibioticDuration: 'greaterThan4h' });

      // Longer duration should have lower risk
      expect(long.riskAtBirth).toBeLessThan(short.riskAtBirth);
    });
  });

  describe('Clinical exam adjustment', () => {
    it('should decrease posterior risk for well-appearing infant', () => {
      const inputs = getDefaultEOSInputs();
      const result = calculateEOS({ ...inputs, clinicalExam: 'well' });

      expect(result.riskPosterior).toBeLessThan(result.riskAtBirth);
    });

    it('should increase posterior risk for equivocal exam', () => {
      const inputs = getDefaultEOSInputs();
      const result = calculateEOS({ ...inputs, clinicalExam: 'equivocal' });

      expect(result.riskPosterior).toBeGreaterThan(result.riskAtBirth);
    });

    it('should significantly increase posterior risk for ill-appearing infant', () => {
      const inputs = getDefaultEOSInputs();
      const result = calculateEOS({ ...inputs, clinicalExam: 'ill' });

      expect(result.riskPosterior).toBeGreaterThan(result.riskAtBirth * 10);
    });
  });

  describe('Gestational age effects', () => {
    it('should have higher risk for preterm infants', () => {
      const baseInputs = getDefaultEOSInputs();

      const term = calculateEOS({ ...baseInputs, gestationalAgeWeeks: 39 });
      const preterm = calculateEOS({ ...baseInputs, gestationalAgeWeeks: 35 });

      expect(preterm.riskAtBirth).toBeGreaterThan(term.riskAtBirth);
    });
  });

  describe('Recommendation categories', () => {
    it('should recommend routine care for very low risk', () => {
      const inputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 37.0,
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);
      expect(result.recommendationCode).toBe('routine');
    });

    it('should recommend empiric antibiotics for ill-appearing infant', () => {
      const inputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 39,
        gestationalAgeDays: 0,
        maternalTempC: 38.5,
        romHours: 24,
        gbsStatus: 'positive',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'ill',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);
      expect(result.recommendationCode).toBe('empiric');
    });
  });

  describe('Baseline incidence adjustment', () => {
    it('should scale risk with baseline incidence', () => {
      const inputs = getDefaultEOSInputs();

      const lowBaseline = calculateEOS({ ...inputs, baselineIncidence: 0.3 });
      const highBaseline = calculateEOS({ ...inputs, baselineIncidence: 1.0 });

      expect(highBaseline.riskAtBirth).toBeGreaterThan(lowBaseline.riskAtBirth);
    });
  });

  describe('2024 Model Verification (KP Scraped Data)', () => {
    it('should match KP base case: 40w, 98°F, 0 ROM, GBS neg = 0.07', () => {
      const inputs: EOSInputs = {
        modelVersion: '2024',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.67, // 98°F
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);
      expect(result.riskAtBirth).toBeCloseTo(0.07, 1);
    });

    it('should match KP: 40w, 100°F, 0 ROM, GBS neg = ~0.39', () => {
      const inputs: EOSInputs = {
        modelVersion: '2024',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 37.78, // 100°F
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);
      expect(result.riskAtBirth).toBeCloseTo(0.39, 1);
    });

    it('should show GBS unknown multiplier ~3x in 2024 model', () => {
      const baseInputs: EOSInputs = {
        modelVersion: '2024',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.67, // 98°F
        romHours: 0,
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });
      const gbsUnk = calculateEOS({ ...baseInputs, gbsStatus: 'unknown' });

      // KP shows: Neg=0.07, Unk=0.22 → ratio ≈ 3.14
      const ratio = gbsUnk.riskAtBirth / gbsNeg.riskAtBirth;
      expect(ratio).toBeGreaterThan(2.5);
      expect(ratio).toBeLessThan(4.0);
    });
  });

  describe('2017 Model Verification (KP Scraped Data)', () => {
    it('should match KP base case: 40w, 98°F, 0 ROM, GBS neg = 0.02', () => {
      const inputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.67, // 98°F
        romHours: 0,
        gbsStatus: 'negative',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);
      expect(result.riskAtBirth).toBeCloseTo(0.02, 1);
    });

    it('should show GBS unknown ≈ negative in 2017 model', () => {
      const baseInputs: EOSInputs = {
        modelVersion: '2017',
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 0,
        maternalTempC: 36.67, // 98°F
        romHours: 0,
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });
      const gbsUnk = calculateEOS({ ...baseInputs, gbsStatus: 'unknown' });

      // KP shows: Neg=0.02, Unk=0.02 → ratio ≈ 1.0
      const ratio = gbsUnk.riskAtBirth / gbsNeg.riskAtBirth;
      expect(ratio).toBeCloseTo(1.0, 0);
    });
  });
});
