/**
 * EOS Calculator Unit Tests
 *
 * Test vectors based on published KP EOS calculator documentation
 * and expected outputs from the original calculator.
 */

import { describe, it, expect } from 'vitest';
import { calculateEOS, getDefaultEOSInputs } from './eos';
import { EOSInputs } from '../types';

describe('EOS Calculator', () => {
  describe('Default inputs (low risk case)', () => {
    it('should calculate low risk for well-appearing term infant with no risk factors', () => {
      const inputs: EOSInputs = {
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

    it('should significantly increase risk with high fever', () => {
      const inputs: EOSInputs = {
        gestationalAgeWeeks: 39,
        gestationalAgeDays: 0,
        maternalTempC: 39.5,
        romHours: 0,
        gbsStatus: 'unknown',
        antibioticType: 'none',
        antibioticDuration: 'none',
        clinicalExam: 'well',
        baselineIncidence: 0.5
      };

      const result = calculateEOS(inputs);

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

    it('should not affect risk for ROM < 18 hours', () => {
      const baseInputs = getDefaultEOSInputs();

      const rom0 = calculateEOS({ ...baseInputs, romHours: 0 });
      const rom12 = calculateEOS({ ...baseInputs, romHours: 12 });

      // Should be very close (within floating point tolerance)
      expect(Math.abs(rom12.riskAtBirth - rom0.riskAtBirth)).toBeLessThan(0.01);
    });
  });

  describe('GBS status cases', () => {
    it('should increase risk with positive GBS', () => {
      const baseInputs = getDefaultEOSInputs();

      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });
      const gbsPos = calculateEOS({ ...baseInputs, gbsStatus: 'positive' });

      expect(gbsPos.riskAtBirth).toBeGreaterThan(gbsNeg.riskAtBirth);
    });

    it('should decrease risk with negative GBS', () => {
      const baseInputs = getDefaultEOSInputs();

      const gbsUnk = calculateEOS({ ...baseInputs, gbsStatus: 'unknown' });
      const gbsNeg = calculateEOS({ ...baseInputs, gbsStatus: 'negative' });

      expect(gbsNeg.riskAtBirth).toBeLessThan(gbsUnk.riskAtBirth);
    });
  });

  describe('Antibiotic effects', () => {
    it('should decrease risk with adequate antibiotics', () => {
      const inputs: EOSInputs = {
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

    it('should have greater effect with longer antibiotic duration', () => {
      const baseInputs: EOSInputs = {
        ...getDefaultEOSInputs(),
        gbsStatus: 'positive',
        antibioticType: 'gbsSpecific'
      };

      const short = calculateEOS({ ...baseInputs, antibioticDuration: 'lessThan2h' });
      const medium = calculateEOS({ ...baseInputs, antibioticDuration: '2to4h' });
      const long = calculateEOS({ ...baseInputs, antibioticDuration: 'greaterThan4h' });

      expect(medium.riskAtBirth).toBeLessThan(short.riskAtBirth);
      expect(long.riskAtBirth).toBeLessThan(medium.riskAtBirth);
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
});
