/**
 * Shared chip option lists and helpers used by both Mobile and Desktop shells.
 * The shells diverge in layout; the actual data wiring is identical.
 */
import { EOSInputs, BiliInputs } from '../types';

export const GBS_OPTIONS = [
  { value: 'negative', label: 'Neg' },
  { value: 'positive', label: 'Pos' },
  { value: 'unknown', label: 'Unk' },
] as const;

export const ABX_TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'gbsSpecific', label: 'GBS-abx', hint: 'Pen / Amp / Cefaz' },
  { value: 'broadSpectrum', label: 'Broad', hint: 'Broad-spectrum coverage' },
] as const;

export const ABX_DURATION_OPTIONS = [
  { value: 'lessThan2h', label: '<2h' },
  { value: '2to4h', label: '2–4h' },
  { value: 'greaterThan4h', label: '≥4h' },
] as const;

export const EXAM_OPTIONS = [
  { value: 'well', label: 'Well' },
  { value: 'equivocal', label: 'Equiv' },
  { value: 'ill', label: 'Ill' },
] as const;

export const MODEL_OPTIONS = [
  { value: '2024', label: '2024' },
  { value: '2017', label: '2017' },
] as const;

export type EOSChange = (updates: Partial<EOSInputs>) => void;
export type BiliChange = (updates: Partial<BiliInputs>) => void;

export function recommendationColor(code: string): string {
  switch (code) {
    case 'routine': return 'rec-routine';
    case 'enhanced': return 'rec-enhanced';
    case 'labs': return 'rec-labs';
    case 'empiric': return 'rec-empiric';
    default: return '';
  }
}

export function biliDeltaColor(delta: number): string {
  if (delta >= 0) return 'bili-above';
  if (delta >= -2) return 'bili-near';
  return 'bili-below';
}
