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

interface MobileShellProps {
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

export function MobileShell({
  eosInputs,
  biliInputs,
  eosOutputs,
  biliOutputs,
  onEOSChange,
  onBiliChange,
  onOpenMenu,
  onResetAll,
  patientLabel,
}: MobileShellProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const combinedNote = formatCombinedNote(patientLabel, eosInputs, eosOutputs, biliInputs, biliOutputs);

  const handleCopy = async () => {
    if (await copyToClipboard(combinedNote)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="m-shell">
      <header className="m-top">
        <button className="m-iconbtn" onClick={onResetAll} aria-label="Reset for next baby">
          ↺
        </button>
        <div className="m-title">NeoCalc</div>
        <button className="m-iconbtn" onClick={onOpenMenu} aria-label="Menu">
          ⋮
        </button>
      </header>

      <main className="m-body">
        <section className="m-section">
          <div className="m-row">
            <Stepper
              label="GA wks"
              value={eosInputs.gestationalAgeWeeks}
              onChange={(v) => onEOSChange({ gestationalAgeWeeks: v })}
              min={22}
              max={44}
            />
            <Stepper
              label="days"
              value={eosInputs.gestationalAgeDays}
              onChange={(v) => onEOSChange({ gestationalAgeDays: v })}
              min={0}
              max={6}
            />
          </div>
          <div className="m-row">
            <Stepper
              label="TMax °C"
              value={eosInputs.maternalTempC}
              onChange={(v) => onEOSChange({ maternalTempC: v })}
              step={0.1}
              decimals={1}
              inputMode="decimal"
              min={35}
              max={42}
            />
            <Stepper
              label="ROM h"
              value={eosInputs.romHours}
              onChange={(v) => onEOSChange({ romHours: v })}
              min={0}
              max={200}
            />
          </div>
        </section>

        <section className="m-section">
          <ChipGroup
            label="GBS"
            options={[...GBS_OPTIONS]}
            value={eosInputs.gbsStatus}
            onChange={(v) => onEOSChange({ gbsStatus: v })}
          />
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
          <ChipGroup
            label="Infant exam"
            options={[...EXAM_OPTIONS]}
            value={eosInputs.clinicalExam}
            onChange={(v) => onEOSChange({ clinicalExam: v })}
          />
        </section>

        <section className="m-section m-section-bili">
          <div className="m-section-title">Bilirubin</div>
          <div className="m-row">
            <Stepper
              label="Age h"
              value={biliInputs.ageHours}
              onChange={(v) => onBiliChange({ ageHours: v })}
              min={0}
              max={336}
              step={1}
            />
            <Stepper
              label="TSB mg/dL"
              value={biliInputs.tsbValue}
              onChange={(v) => onBiliChange({ tsbValue: v })}
              step={0.1}
              decimals={1}
              inputMode="decimal"
              min={0}
              max={40}
            />
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
          <label className="m-checkbox">
            <input
              type="checkbox"
              checked={biliInputs.hasNeurotoxRiskFactors}
              onChange={(e) => onBiliChange({ hasNeurotoxRiskFactors: e.target.checked })}
            />
            <span>Neurotoxicity risk factors</span>
          </label>
        </section>

        <section className="m-section">
          <button
            type="button"
            className="m-disclosure"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? '▾' : '▸'} Advanced
          </button>
          {advancedOpen && (
            <div className="m-advanced">
              <ChipGroup
                label="EOS model"
                options={[...MODEL_OPTIONS]}
                value={eosInputs.modelVersion}
                onChange={(v) => onEOSChange({ modelVersion: v as EOSModelVersion })}
              />
              <Stepper
                label="Baseline incidence /1000"
                value={eosInputs.baselineIncidence}
                onChange={(v) => onEOSChange({ baselineIncidence: v })}
                step={0.1}
                decimals={1}
                inputMode="decimal"
                min={0.1}
                max={5}
              />
            </div>
          )}
        </section>

        <div className="m-spacer" />
      </main>

      <div className={`m-dock${detailOpen ? ' m-dock-open' : ''}`}>
        {detailOpen && (
          <div className="m-dock-detail">
            <div className="m-dock-detail-row">
              <span>Risk at birth</span>
              <strong>{eosOutputs ? `${eosOutputs.riskAtBirth.toFixed(2)}/1000` : '—'}</strong>
            </div>
            <div className="m-dock-detail-row">
              <span>Photo threshold</span>
              <strong>{biliOutputs ? `${biliOutputs.photoThreshold.toFixed(1)} mg/dL` : '—'}</strong>
            </div>
            <pre className="m-dock-note">{combinedNote || 'No results yet.'}</pre>
          </div>
        )}
        <div className="m-dock-bar">
          <button
            type="button"
            className="m-dock-primary"
            onClick={() => setDetailOpen(!detailOpen)}
            aria-expanded={detailOpen}
          >
            <div className="m-dock-numbers">
              <div className="m-dock-eos">
                <span className="m-dock-eos-value">
                  {eosOutputs ? eosOutputs.riskPosterior.toFixed(2) : '—'}
                </span>
                <span className="m-dock-eos-unit">/1000 EOS</span>
              </div>
              <div className={`m-dock-rec ${eosOutputs ? recommendationColor(eosOutputs.recommendationCode) : ''}`}>
                {eosOutputs ? eosOutputs.recommendationCode.toUpperCase() : '—'}
              </div>
            </div>
            <div className="m-dock-bili">
              <span className={biliOutputs ? biliDeltaColor(biliOutputs.deltaToPhoto) : ''}>
                Bili Δ {biliOutputs
                  ? `${biliOutputs.deltaToPhoto >= 0 ? '+' : ''}${biliOutputs.deltaToPhoto.toFixed(1)}`
                  : '—'}
              </span>
              <span className="m-dock-bili-photo">
                photo {biliOutputs ? biliOutputs.photoThreshold.toFixed(1) : '—'}
              </span>
            </div>
          </button>
          <button
            type="button"
            className={`m-dock-copy${copied ? ' m-dock-copy-on' : ''}`}
            onClick={handleCopy}
            aria-label="Copy combined note"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
