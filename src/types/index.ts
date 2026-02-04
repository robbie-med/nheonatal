// Core types for the Neonatal Calculator application

export interface Patient {
  patientId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface EOSInputs {
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  maternalTempC: number;
  romHours: number;
  gbsStatus: 'positive' | 'negative' | 'unknown';
  antibioticType: 'none' | 'gbsSpecific' | 'broadSpectrum';
  antibioticDuration: 'none' | 'lessThan2h' | '2to4h' | 'greaterThan4h';
  clinicalExam: 'well' | 'equivocal' | 'ill';
  baselineIncidence: number;
}

export interface EOSOutputs {
  riskAtBirth: number;
  riskPosterior: number;
  recommendationCode: 'routine' | 'enhanced' | 'labs' | 'empiric';
  recommendationText: string;
}

export interface BiliInputs {
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  birthTime: string;
  sampleTime: string;
  ageHours: number;
  tsbValue: number;
  hasNeurotoxRiskFactors: boolean;
  riskFactorDetails?: string;
}

export interface BiliOutputs {
  photoThreshold: number;
  exchangeThreshold: number;
  deltaToPhoto: number;
  followupGuidance: string;
  apiResponse?: BiliApiResponse;
  isCached: boolean;
}

export interface BiliApiResponse {
  ga: number;
  age: number;
  bili: number;
  risk: string;
  photo_threshold: number;
  exchange_threshold: number;
  above_photo: boolean;
  above_exchange: boolean;
}

export interface Snapshot {
  snapshotId: string;
  patientId: string;
  timestamp: string;
  inputs: {
    eos: EOSInputs;
    bili: BiliInputs;
  };
  outputs: {
    eos: EOSOutputs | null;
    bili: BiliOutputs | null;
  };
  notes: {
    eosNoteAscii: string;
    biliNoteAscii: string;
  };
}

export interface KPStatus {
  last_checked_iso: string;
  fingerprint_current: string;
  fingerprint_expected: string;
  status: 'ok' | 'changed' | 'error';
  source_url: string;
}

export interface AppConfig {
  eos: {
    baseline_incidence_per_1000: number;
    recommendation_thresholds: {
      routine_max: number;
      enhanced_max: number;
      labs_max: number;
    };
  };
  bili: {
    api_enabled: boolean;
    api_base_url: string;
  };
  ui: {
    show_exchange_threshold: boolean;
    theme_default: 'light' | 'dark' | 'system';
  };
}

export type Theme = 'light' | 'dark' | 'system';
