/**
 * Kaiser Permanente EOS Calculator Site Change Monitor
 *
 * Monitors for changes to the KP EOS model documentation that might
 * indicate updates to the underlying algorithm.
 */

import { KPStatus } from '../types';

const STATUS_FILE_URL = '/kp_status.json';

// Default status when unable to fetch
const DEFAULT_STATUS: KPStatus = {
  last_checked_iso: '',
  fingerprint_current: '',
  fingerprint_expected: '',
  status: 'error',
  source_url: 'https://neonatalsepsiscalculator.kaiserpermanente.org/ModelUpdateFAQ.aspx'
};

/**
 * Fetch KP status from the pre-generated status file
 * This file is updated by a GitHub Action that runs periodically
 */
export async function fetchKPStatus(): Promise<KPStatus> {
  try {
    const response = await fetch(STATUS_FILE_URL);
    if (!response.ok) {
      console.warn('Failed to fetch KP status file:', response.status);
      return DEFAULT_STATUS;
    }

    const status: KPStatus = await response.json();
    return status;
  } catch (error) {
    console.warn('Error fetching KP status:', error);
    return DEFAULT_STATUS;
  }
}

/**
 * Check if the KP status indicates a potential model change
 */
export function isKPModelChanged(status: KPStatus): boolean {
  return status.status === 'changed';
}

/**
 * Check if the KP status check encountered an error
 */
export function isKPStatusError(status: KPStatus): boolean {
  return status.status === 'error';
}

/**
 * Get a user-friendly message about the KP status
 */
export function getKPStatusMessage(status: KPStatus): string {
  switch (status.status) {
    case 'ok':
      return 'KP EOS model validated';
    case 'changed':
      return 'KP EOS reference page changed - model may need review';
    case 'error':
      return 'Unable to verify KP EOS model status';
    default:
      return 'Unknown status';
  }
}

/**
 * Get the appropriate color indicator for the status
 */
export function getKPStatusColor(status: KPStatus): 'green' | 'yellow' | 'red' | 'gray' {
  switch (status.status) {
    case 'ok':
      return 'green';
    case 'changed':
      return 'yellow';
    case 'error':
      return 'gray';
    default:
      return 'gray';
  }
}
