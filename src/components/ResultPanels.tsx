import { useState } from 'react';
import { EOSInputs, EOSOutputs, BiliInputs, BiliOutputs } from '../types';
import { formatEOSNote, formatBiliNote, copyToClipboard } from '../format/asciiNotes';

interface ResultPanelsProps {
  patientLabel: string;
  eosInputs: EOSInputs;
  biliInputs: BiliInputs;
  eosOutputs: EOSOutputs | null;
  biliOutputs: BiliOutputs | null;
  biliLoading: boolean;
  showExchangeThreshold: boolean;
}

export function ResultPanels({
  patientLabel,
  eosInputs,
  biliInputs,
  eosOutputs,
  biliOutputs,
  biliLoading,
  showExchangeThreshold
}: ResultPanelsProps) {
  const [eosCopied, setEosCopied] = useState(false);
  const [biliCopied, setBiliCopied] = useState(false);

  const eosNote = eosOutputs ? formatEOSNote(patientLabel, eosInputs, eosOutputs) : '';
  const biliNote = biliOutputs ? formatBiliNote(patientLabel, biliInputs, biliOutputs) : '';

  const handleCopyEOS = async () => {
    if (await copyToClipboard(eosNote)) {
      setEosCopied(true);
      setTimeout(() => setEosCopied(false), 2000);
    }
  };

  const handleCopyBili = async () => {
    if (await copyToClipboard(biliNote)) {
      setBiliCopied(true);
      setTimeout(() => setBiliCopied(false), 2000);
    }
  };

  const getRecommendationClass = (code: EOSOutputs['recommendationCode']): string => {
    switch (code) {
      case 'routine': return 'rec-routine';
      case 'enhanced': return 'rec-enhanced';
      case 'labs': return 'rec-labs';
      case 'empiric': return 'rec-empiric';
      default: return '';
    }
  };

  const getBiliStatusClass = (delta: number): string => {
    if (delta >= 0) return 'bili-above';
    if (delta >= -2) return 'bili-near';
    return 'bili-below';
  };

  return (
    <section className="section result-panels">
      <div className="panels-grid">
        {/* EOS Panel */}
        <div className="panel panel-eos">
          <h3>EOS Risk (Kaiser Permanente Model)</h3>

          {eosOutputs ? (
            <>
              <div className="result-summary">
                <div className="result-item">
                  <span className="result-label">Risk at Birth:</span>
                  <span className="result-value">{eosOutputs.riskAtBirth.toFixed(2)}/1000</span>
                </div>
                <div className="result-item result-primary">
                  <span className="result-label">Post-Exam Risk:</span>
                  <span className="result-value">{eosOutputs.riskPosterior.toFixed(2)}/1000</span>
                </div>
                <div className={`result-item result-recommendation ${getRecommendationClass(eosOutputs.recommendationCode)}`}>
                  <span className="result-label">Recommendation:</span>
                  <span className="result-value rec-badge">
                    {eosOutputs.recommendationCode.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="note-container">
                <div className="note-header">
                  <span>ASCII Note:</span>
                  <button
                    className={`btn btn-sm ${eosCopied ? 'btn-success' : 'btn-secondary'}`}
                    onClick={handleCopyEOS}
                  >
                    {eosCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  className="note-textarea"
                  value={eosNote}
                  readOnly
                  rows={8}
                />
              </div>
            </>
          ) : (
            <div className="panel-placeholder">Enter data to calculate EOS risk</div>
          )}
        </div>

        {/* Bili Panel */}
        <div className="panel panel-bili">
          <h3>Bilirubin (AAP 2022)</h3>

          {biliLoading ? (
            <div className="panel-loading">Calculating...</div>
          ) : biliOutputs ? (
            <>
              <div className="result-summary">
                <div className="result-item">
                  <span className="result-label">Photo Threshold:</span>
                  <span className="result-value">{biliOutputs.photoThreshold.toFixed(1)} mg/dL</span>
                </div>
                {showExchangeThreshold && (
                  <div className="result-item">
                    <span className="result-label">Exchange Threshold:</span>
                    <span className="result-value">{biliOutputs.exchangeThreshold.toFixed(1)} mg/dL</span>
                  </div>
                )}
                <div className={`result-item result-primary ${getBiliStatusClass(biliOutputs.deltaToPhoto)}`}>
                  <span className="result-label">Delta to Photo:</span>
                  <span className="result-value">
                    {biliOutputs.deltaToPhoto >= 0 ? '+' : ''}{biliOutputs.deltaToPhoto.toFixed(1)} mg/dL
                  </span>
                </div>
                {biliOutputs.isCached && (
                  <div className="result-item result-warning">
                    <span className="result-label">Note:</span>
                    <span className="result-value">Using local calculation (API unavailable)</span>
                  </div>
                )}
              </div>

              <div className="note-container">
                <div className="note-header">
                  <span>ASCII Note:</span>
                  <button
                    className={`btn btn-sm ${biliCopied ? 'btn-success' : 'btn-secondary'}`}
                    onClick={handleCopyBili}
                  >
                    {biliCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  className="note-textarea"
                  value={biliNote}
                  readOnly
                  rows={8}
                />
              </div>
            </>
          ) : (
            <div className="panel-placeholder">Enter data to calculate bili thresholds</div>
          )}
        </div>
      </div>
    </section>
  );
}
