import { useState } from 'react';
import { EOSInputs, BiliInputs } from '../types';
import {
  NEUROTOXICITY_RISK_FACTORS,
  SIGNIFICANT_HYPERBILIRUBINEMIA_RISK_FACTORS
} from '../calc/biliThresholds';

interface InputFormProps {
  eosInputs: EOSInputs;
  biliInputs: BiliInputs;
  onEOSChange: (updates: Partial<EOSInputs>) => void;
  onBiliChange: (updates: Partial<BiliInputs>) => void;
}

export function InputForm({
  eosInputs,
  biliInputs,
  onEOSChange,
  onBiliChange
}: InputFormProps) {
  const [showNeurotoxRiskInfo, setShowNeurotoxRiskInfo] = useState(false);
  const [showHyperBiliRiskInfo, setShowHyperBiliRiskInfo] = useState(false);

  return (
    <section className="section input-form">
      <h2>Patient Data</h2>

      <div className="form-grid">
        {/* Shared: Gestational Age */}
        <fieldset className="fieldset fieldset-shared">
          <legend>Gestational Age (shared)</legend>
          <div className="input-group">
            <label>
              Weeks:
              <input
                type="number"
                min="22"
                max="44"
                value={eosInputs.gestationalAgeWeeks}
                onChange={(e) => onEOSChange({ gestationalAgeWeeks: parseInt(e.target.value) || 0 })}
                className="input-number input-sm"
              />
            </label>
            <label>
              Days:
              <input
                type="number"
                min="0"
                max="6"
                value={eosInputs.gestationalAgeDays}
                onChange={(e) => onEOSChange({ gestationalAgeDays: parseInt(e.target.value) || 0 })}
                className="input-number input-xs"
              />
            </label>
          </div>
        </fieldset>

        {/* EOS-specific inputs */}
        <fieldset className="fieldset fieldset-eos">
          <legend>EOS Risk Factors</legend>

          <div className="input-row">
            <label>
              Maternal TMax (C):
              <input
                type="number"
                step="0.1"
                min="35"
                max="42"
                value={eosInputs.maternalTempC}
                onChange={(e) => onEOSChange({ maternalTempC: parseFloat(e.target.value) || 37 })}
                className="input-number"
              />
            </label>

            <label>
              ROM (hours):
              <input
                type="number"
                min="0"
                max="200"
                value={eosInputs.romHours}
                onChange={(e) => onEOSChange({ romHours: parseInt(e.target.value) || 0 })}
                className="input-number"
              />
            </label>
          </div>

          <div className="input-row">
            <label>
              GBS Status:
              <select
                value={eosInputs.gbsStatus}
                onChange={(e) => onEOSChange({ gbsStatus: e.target.value as EOSInputs['gbsStatus'] })}
                className="input-select"
              >
                <option value="unknown">Unknown</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
            </label>

            <label>
              Antibiotics:
              <select
                value={eosInputs.antibioticType}
                onChange={(e) => onEOSChange({ antibioticType: e.target.value as EOSInputs['antibioticType'] })}
                className="input-select"
              >
                <option value="none">None</option>
                <option value="gbsSpecific">GBS-specific (Pen/Amp/Cefaz)</option>
                <option value="broadSpectrum">Broad spectrum</option>
              </select>
            </label>
          </div>

          {eosInputs.antibioticType !== 'none' && (
            <div className="input-row">
              <label>
                Antibiotic Duration:
                <select
                  value={eosInputs.antibioticDuration}
                  onChange={(e) => onEOSChange({ antibioticDuration: e.target.value as EOSInputs['antibioticDuration'] })}
                  className="input-select"
                >
                  <option value="none">Not given</option>
                  <option value="lessThan2h">&lt; 2 hours before delivery</option>
                  <option value="2to4h">2-4 hours before delivery</option>
                  <option value="greaterThan4h">&ge; 4 hours before delivery</option>
                </select>
              </label>
            </div>
          )}

          <div className="input-row">
            <label>
              Clinical Exam:
              <select
                value={eosInputs.clinicalExam}
                onChange={(e) => onEOSChange({ clinicalExam: e.target.value as EOSInputs['clinicalExam'] })}
                className="input-select"
              >
                <option value="well">Well-appearing</option>
                <option value="equivocal">Equivocal</option>
                <option value="ill">Clinical illness</option>
              </select>
            </label>

            <label>
              Baseline Incidence (/1000):
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={eosInputs.baselineIncidence}
                onChange={(e) => onEOSChange({ baselineIncidence: parseFloat(e.target.value) || 0.5 })}
                className="input-number"
              />
            </label>
          </div>
        </fieldset>

        {/* Bili-specific inputs */}
        <fieldset className="fieldset fieldset-bili">
          <legend>Bilirubin Data</legend>

          <div className="input-row">
            <label>
              Birth Time:
              <input
                type="datetime-local"
                value={biliInputs.birthTime}
                onChange={(e) => onBiliChange({ birthTime: e.target.value })}
                className="input-datetime"
              />
            </label>

            <label>
              Sample Time:
              <input
                type="datetime-local"
                value={biliInputs.sampleTime}
                onChange={(e) => onBiliChange({ sampleTime: e.target.value })}
                className="input-datetime"
              />
            </label>
          </div>

          <div className="input-row">
            <label>
              Age (hours):
              <input
                type="number"
                value={biliInputs.ageHours}
                onChange={(e) => onBiliChange({ ageHours: parseFloat(e.target.value) || 0 })}
                className="input-number"
                readOnly
                title="Calculated from birth and sample times"
              />
            </label>

            <label>
              TSB (mg/dL):
              <input
                type="number"
                step="0.1"
                min="0"
                max="40"
                value={biliInputs.tsbValue}
                onChange={(e) => onBiliChange({ tsbValue: parseFloat(e.target.value) || 0 })}
                className="input-number"
              />
            </label>
          </div>

          <div className="input-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={biliInputs.hasNeurotoxRiskFactors}
                onChange={(e) => onBiliChange({ hasNeurotoxRiskFactors: e.target.checked })}
              />
              <span>
                Neurotoxicity risk factors present
                <button
                  type="button"
                  className="info-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowNeurotoxRiskInfo(!showNeurotoxRiskInfo);
                  }}
                  title="Show/hide neurotoxicity risk factors"
                >
                  {showNeurotoxRiskInfo ? '▼' : '▶'} info
                </button>
              </span>
            </label>
          </div>

          {showNeurotoxRiskInfo && (
            <div className="risk-info-panel">
              <h4>Neurotoxicity Risk Factors (AAP 2022)</h4>
              <p className="risk-info-note">Use lower thresholds if ANY of these are present:</p>
              <ul className="risk-factor-list">
                {NEUROTOXICITY_RISK_FACTORS.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="input-row">
            <button
              type="button"
              className="info-toggle-standalone"
              onClick={() => setShowHyperBiliRiskInfo(!showHyperBiliRiskInfo)}
            >
              {showHyperBiliRiskInfo ? '▼' : '▶'} Significant Hyperbilirubinemia Risk Factors
            </button>
          </div>

          {showHyperBiliRiskInfo && (
            <div className="risk-info-panel">
              <h4>Significant Hyperbilirubinemia Risk Factors (AAP 2022)</h4>
              <p className="risk-info-note">Factors that increase risk of severe hyperbilirubinemia:</p>
              <ul className="risk-factor-list">
                {SIGNIFICANT_HYPERBILIRUBINEMIA_RISK_FACTORS.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
      </div>
    </section>
  );
}
