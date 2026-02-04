/**
 * ASCII Note Formatters
 * Generates copy-ready clinical documentation notes
 */

import { EOSInputs, EOSOutputs, BiliInputs, BiliOutputs } from '../types';

/**
 * Format date as compact ASCII: DDMMMYYYY HHmm (e.g., 04FEB2026 2140)
 */
export function formatDateCompact(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');

  return `${day}${month}${year} ${hours}${mins}`;
}

/**
 * Format gestational age as weeks+days string
 */
function formatGA(weeks: number, days: number): string {
  return `${weeks}w${days}d`;
}

/**
 * Format GBS status for display
 */
function formatGBS(status: EOSInputs['gbsStatus']): string {
  switch (status) {
    case 'positive': return 'pos';
    case 'negative': return 'neg';
    case 'unknown': return 'unk';
    default: return 'unk';
  }
}

/**
 * Format antibiotic type and duration
 */
function formatAntibiotics(type: EOSInputs['antibioticType'], duration: EOSInputs['antibioticDuration']): string {
  if (type === 'none' || duration === 'none') {
    return 'none';
  }

  const typeStr = type === 'gbsSpecific' ? 'GBS-abx' : 'broad-abx';
  let durationStr = '';

  switch (duration) {
    case 'lessThan2h': durationStr = '<2h'; break;
    case '2to4h': durationStr = '2-4h'; break;
    case 'greaterThan4h': durationStr = '>=4h'; break;
    default: durationStr = '';
  }

  return `${typeStr} ${durationStr}`;
}

/**
 * Format clinical exam category
 */
function formatExam(exam: EOSInputs['clinicalExam']): string {
  switch (exam) {
    case 'well': return 'well-appearing';
    case 'equivocal': return 'equivocal exam';
    case 'ill': return 'ill-appearing';
    default: return 'unknown';
  }
}

/**
 * Generate EOS ASCII note
 */
export function formatEOSNote(
  patientLabel: string,
  inputs: EOSInputs,
  outputs: EOSOutputs,
  timestamp?: Date
): string {
  const ts = timestamp || new Date();
  const dateStr = formatDateCompact(ts);
  const gaStr = formatGA(inputs.gestationalAgeWeeks, inputs.gestationalAgeDays);

  const lines = [
    `EOS RISK (KP MODEL) ${dateStr}`,
    `Pt: ${patientLabel} GA ${gaStr}`,
    `Maternal: TMax ${inputs.maternalTempC.toFixed(1)}C ROM ${inputs.romHours}h GBS ${formatGBS(inputs.gbsStatus)} IAP ${formatAntibiotics(inputs.antibioticType, inputs.antibioticDuration)}`,
    `Infant: ${formatExam(inputs.clinicalExam)}`,
    `Risk: birth ${outputs.riskAtBirth.toFixed(2)}/1000 post-exam ${outputs.riskPosterior.toFixed(2)}/1000`,
    `A/P: ${outputs.recommendationText}`
  ];

  return lines.join('\n');
}

/**
 * Generate Bili ASCII note
 */
export function formatBiliNote(
  patientLabel: string,
  inputs: BiliInputs,
  outputs: BiliOutputs,
  timestamp?: Date
): string {
  const ts = timestamp || new Date();
  const dateStr = formatDateCompact(ts);
  const gaStr = formatGA(inputs.gestationalAgeWeeks, inputs.gestationalAgeDays);
  const riskStr = inputs.hasNeurotoxRiskFactors ? 'present' : 'none';

  const apiLabel = outputs.isCached ? 'LOCAL CALC' : 'AAP 2022 / PEDITOOLS';

  const lines = [
    `BILI (${apiLabel}) ${dateStr}`,
    `Pt: ${patientLabel} GA ${gaStr} age ${Math.round(inputs.ageHours)}h TSB ${inputs.tsbValue.toFixed(1)} mg/dL neurotox RF: ${riskStr}`,
    `Thresholds: photo ${outputs.photoThreshold.toFixed(1)} exch ${outputs.exchangeThreshold.toFixed(1)} delta ${outputs.deltaToPhoto >= 0 ? '+' : ''}${outputs.deltaToPhoto.toFixed(1)}`,
    `A/P: ${outputs.followupGuidance}`
  ];

  return lines.join('\n');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }
}
