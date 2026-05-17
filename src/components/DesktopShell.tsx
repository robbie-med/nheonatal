import { useState } from 'react';
import { EOSInputs, EOSOutputs, BiliInputs, BiliOutputs, EOSModelVersion } from '../types';
import { ChipGroup } from './ChipGroup';
import { Stepper } from './Stepper';
import {
  GBS_OPTIONS,
  ABX_TYPE_OPTIONS,
  ABX_DURATION_OPTIONS,
  EXAM_OPTIONS,
  MODEL_OPTIONS,
  EOSChange,
  BiliChange,
  recommendationColor,
  biliDeltaColor,
} from './CalcShellShared';
import { formatCombinedNote, copyToClipboard } from '../format/asciiNotes';

interface DesktopShellProps {
  eosInputs: EOSInputs;
  biliInputs: BiliInputs;
  eosOutputs: EOSOutputs | null;
  biliOutputs: BiliOutputs | null;
  onEOSChange: EOSChange;
  onBiliChange: BiliChange;
  onOpenMenu: () => void;
  onResetAll: () => void;
  patientLabel: string;
}

export function DesktopShell({
  eosInputs,
  biliInputs,
  eosOutputs,
  biliOutputs,
  onEOSChange,
  onBiliChange,
  onOpenMenu,
  onResetAll,
  patientLabel,
}: DesktopShellProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const combinedNote = formatCombinedNote(patientLabel, eosInputs, eosOutputs, biliInputs, biliOutputs);

  const handleCopy = async () => {
    if (await copyToClipboard(combinedNote)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="d-shell">
      <header className="d-top">
        <div className="d-title">NeoCalc</div>
        <div className="d-top-actions">
          <button className="d-btn d-btn-ghost" onClick={onResetAll}>↺ Next baby</button>
          <button className="d-iconbtn" onClick={onOpenMenu} aria-label="Menu">⋮</button>
        </div>
      </header>

      <main className="d-grid">
        <section className="d-inputs">
          <div className="d-card">
            <div className="d-card-title">Maternal</div>
            <div className="d-row">
              <Stepper label="GA wks" value={eosInputs.gestationalAgeWeeks} onChange={(v) => onEOSChange({ gestationalAgeWeeks: v })} min={22} max={44} />
              <Stepper label="days" value={eosInputs.gestationalAgeDays} onChange={(v) => onEOSChange({ gestationalAgeDays: v })} min={0} max={6} />
              <Stepper label="TMax °C" value={eosInputs.maternalTempC} onChange={(v) => onEOSChange({ maternalTempC: v })} step={0.1} decimals={1} inputMode="decimal" min={35} max={42} />
              <Stepper label="ROM h" value={eosInputs.romHours} onChange={(v) => onEOSChange({ romHours: v })} min={0} max={200} />
            </div>
            <ChipGroup label="GBS" options={[...GBS_OPTIONS]} value={eosInputs.gbsStatus} onChange={(v) => onEOSChange({ gbsStatus: v })} />
            <ChipGroup
              label="IAP"
              options={[...ABX_TYPE_OPTIONS]}
              value={eosInputs.antibioticType}
              onChange={(v) => {
                const updates: Partial<EOSInputs> = { antibioticType: v };
                if (v === 'none') updates.antibioticDuration = 'none';
                else if (eosInputs.antibioticDuration === 'none') updates.antibioticDuration = 'greaterThan4h';
                onEOSChange(updates);
              }}
            />
            {eosInputs.antibioticType !== 'none' && (
              <ChipGroup
                label="IAP duration"
                options={[...ABX_DURATION_OPTIONS]}
                value={eosInputs.antibioticDuration === 'none' ? 'greaterThan4h' : eosInputs.antibioticDuration}
                onChange={(v) => onEOSChange({ antibioticDuration: v })}
              />
            )}
          </div>

          <div className="d-card">
            <div className="d-card-title">Infant</div>
            <ChipGroup label="Exam" options={[...EXAM_OPTIONS]} value={eosInputs.clinicalExam} onChange={(v) => onEOSChange({ clinicalExam: v })} />
            <div className="d-row">
              <Stepper label="Age h" value={biliInputs.ageHours} onChange={(v) => onBiliChange({ ageHours: v })} min={0} max={336} />
              <Stepper label="TSB mg/dL" value={biliInputs.tsbValue} onChange={(v) => onBiliChange({ tsbValue: v })} step={0.1} decimals={1} inputMode="decimal" min={0} max={40} />
            </div>
            <button
              type="button"
              className="clock-toggle"
              onClick={() => setClockOpen(!clockOpen)}
              aria-expanded={clockOpen}
            >
              {clockOpen ? '▾' : '▸'} 🕐 By clock
            </button>
            {clockOpen && (
              <div className="clock-row">
                <label className="clock-field">
                  <span>Birth</span>
                  <input
                    type="datetime-local"
                    value={biliInputs.birthTime}
                    onChange={(e) => onBiliChange({ birthTime: e.target.value })}
                  />
                </label>
                <label className="clock-field">
                  <span>Sample</span>
                  <input
                    type="datetime-local"
                    value={biliInputs.sampleTime}
                    onChange={(e) => onBiliChange({ sampleTime: e.target.value })}
                  />
                </label>
              </div>
            )}
            <label className="d-checkbox">
              <input
                type="checkbox"
                checked={biliInputs.hasNeurotoxRiskFactors}
                onChange={(e) => onBiliChange({ hasNeurotoxRiskFactors: e.target.checked })}
              />
              <span>Neurotoxicity risk factors</span>
            </label>
          </div>

          <div className="d-card">
            <button type="button" className="d-disclosure" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
              {advancedOpen ? '▾' : '▸'} Advanced
            </button>
            {advancedOpen && (
              <div className="d-advanced">
                <ChipGroup label="EOS model" options={[...MODEL_OPTIONS]} value={eosInputs.modelVersion} onChange={(v) => onEOSChange({ modelVersion: v as EOSModelVersion })} />
                <Stepper label="Baseline incidence /1000" value={eosInputs.baselineIncidence} onChange={(v) => onEOSChange({ baselineIncidence: v })} step={0.1} decimals={1} inputMode="decimal" min={0.1} max={5} />
              </div>
            )}
          </div>
        </section>

        <aside className="d-results">
          <div className="d-result-card">
            <div className="d-result-section">
              <div className="d-result-header">EOS</div>
              <div className="d-result-numbers">
                <div className="d-result-primary">
                  <span className="d-result-value">
                    {eosOutputs ? eosOutputs.riskPosterior.toFixed(2) : '—'}
                  </span>
                  <span className="d-result-unit">/1000 post-exam</span>
                </div>
                <div className="d-result-secondary">
                  birth {eosOutputs ? eosOutputs.riskAtBirth.toFixed(2) : '—'}/1000
                </div>
              </div>
              <div className={`d-rec ${eosOutputs ? recommendationColor(eosOutputs.recommendationCode) : ''}`}>
                {eosOutputs ? eosOutputs.recommendationCode.toUpperCase() : '—'}
              </div>
              {eosOutputs && (
                <div className="d-result-rec-text">{eosOutputs.recommendationText}</div>
              )}
            </div>

            <div className="d-result-section">
              <div className="d-result-header">Bilirubin</div>
              <div className="d-result-numbers">
                <div className={`d-result-primary ${biliOutputs ? biliDeltaColor(biliOutputs.deltaToPhoto) : ''}`}>
                  <span className="d-result-value">
                    {biliOutputs
                      ? `${biliOutputs.deltaToPhoto >= 0 ? '+' : ''}${biliOutputs.deltaToPhoto.toFixed(1)}`
                      : '—'}
                  </span>
                  <span className="d-result-unit">Δ to photo</span>
                </div>
                <div className="d-result-secondary">
                  photo {biliOutputs ? biliOutputs.photoThreshold.toFixed(1) : '—'} ·
                  exch {biliOutputs ? biliOutputs.exchangeThreshold.toFixed(1) : '—'}
                </div>
              </div>
              {biliOutputs && (
                <div className="d-result-rec-text">{biliOutputs.followupGuidance}</div>
              )}
            </div>
          </div>

          <div className="d-note-card">
            <div className="d-note-header">
              <span>Combined ASCII note</span>
              <button
                type="button"
                className={`d-btn${copied ? ' d-btn-on' : ''}`}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="d-note-pre">{combinedNote || 'No results yet.'}</pre>
          </div>
        </aside>
      </main>
    </div>
  );
}
