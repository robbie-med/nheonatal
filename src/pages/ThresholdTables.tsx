import { useState } from 'react';
import {
  PHOTO_NO_RISK,
  PHOTO_WITH_RISK,
  EXCHANGE_NO_RISK,
  EXCHANGE_WITH_RISK,
  NEUROTOXICITY_RISK_FACTORS,
  SIGNIFICANT_HYPERBILIRUBINEMIA_RISK_FACTORS
} from '../calc/biliThresholds';

const AAP_SOURCE_URL = 'https://publications.aap.org/pediatrics/article/150/3/e2022058859/188824/Clinical-Practice-Guideline-Revision-Management';
const AAP_SUPPLEMENT_PDF = 'https://aap2.silverchair-cdn.com/aap2/content_public/journal/pediatrics/150/3/10.1542_peds.2022-058859/5/peds_2022058859supplementarydata.pdf';

interface ThresholdTablesProps {
  onBack: () => void;
}

type TableType = 'photo-no-risk' | 'photo-with-risk' | 'exchange-no-risk' | 'exchange-with-risk';

export function ThresholdTables({ onBack }: ThresholdTablesProps) {
  const [selectedTable, setSelectedTable] = useState<TableType>('photo-no-risk');
  const [selectedGA, setSelectedGA] = useState<number>(40);

  const getTableData = (): Record<number, number[]> => {
    switch (selectedTable) {
      case 'photo-no-risk': return PHOTO_NO_RISK;
      case 'photo-with-risk': return PHOTO_WITH_RISK;
      case 'exchange-no-risk': return EXCHANGE_NO_RISK;
      case 'exchange-with-risk': return EXCHANGE_WITH_RISK;
    }
  };

  const getTableTitle = (): string => {
    switch (selectedTable) {
      case 'photo-no-risk': return 'Phototherapy Thresholds - No Neurotoxicity Risk Factors';
      case 'photo-with-risk': return 'Phototherapy Thresholds - With Neurotoxicity Risk Factors';
      case 'exchange-no-risk': return 'Exchange Transfusion Thresholds - No Neurotoxicity Risk Factors';
      case 'exchange-with-risk': return 'Exchange Transfusion Thresholds - With Neurotoxicity Risk Factors';
    }
  };

  const getSupplementTableRef = (): string => {
    switch (selectedTable) {
      case 'photo-no-risk': return 'Supplemental Table S1';
      case 'photo-with-risk': return 'Supplemental Table S2';
      case 'exchange-no-risk': return 'Supplemental Table S3';
      case 'exchange-with-risk': return 'Supplemental Table S4';
    }
  };

  const tableData = getTableData();
  const availableGAs = Object.keys(tableData).map(Number).sort((a, b) => b - a);
  const thresholds = tableData[selectedGA] || [];

  // Group thresholds by day for display
  const dayData: { day: number; hours: { hour: number; value: number }[] }[] = [];
  for (let day = 0; day <= 14; day++) {
    const hours: { hour: number; value: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const hourIndex = day * 24 + h;
      if (hourIndex < thresholds.length) {
        hours.push({ hour: hourIndex, value: thresholds[hourIndex] });
      }
    }
    if (hours.length > 0) {
      dayData.push({ day, hours });
    }
  }

  return (
    <div className="threshold-tables-page">
      <header className="tables-header">
        <button onClick={onBack} className="btn btn-secondary">
          ← Back to Calculator
        </button>
        <h1>AAP 2022 Bilirubin Threshold Tables</h1>
      </header>

      <main className="tables-content">
        <section className="source-attribution">
          <h2>Data Source</h2>
          <p>
            These threshold values are from the <strong>American Academy of Pediatrics (AAP) 2022 Clinical Practice Guideline</strong> for the management of hyperbilirubinemia in newborns ≥35 weeks' gestation.
          </p>
          <div className="source-links">
            <a href={AAP_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="source-link">
              📄 AAP Clinical Practice Guideline (Pediatrics 2022;150(3):e2022058859)
            </a>
            <a href={AAP_SUPPLEMENT_PDF} target="_blank" rel="noopener noreferrer" className="source-link">
              📊 Supplementary Data Tables (PDF)
            </a>
          </div>
          <p className="citation">
            Kemper AR, Newman TB, Slaughter JL, et al. Clinical Practice Guideline Revision: Management of Hyperbilirubinemia in the Newborn Infant 35 or More Weeks of Gestation. <em>Pediatrics</em>. 2022;150(3):e2022058859.
          </p>
        </section>

        <section className="risk-factors-section">
          <div className="risk-factors-grid">
            <div className="risk-factor-box">
              <h3>Neurotoxicity Risk Factors</h3>
              <p className="risk-note">Presence of ANY factor warrants using lower thresholds:</p>
              <ul>
                {NEUROTOXICITY_RISK_FACTORS.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
            <div className="risk-factor-box">
              <h3>Significant Hyperbilirubinemia Risk Factors</h3>
              <p className="risk-note">Factors that increase risk of developing severe hyperbilirubinemia:</p>
              <ul>
                {SIGNIFICANT_HYPERBILIRUBINEMIA_RISK_FACTORS.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="table-selector">
          <h2>Threshold Tables</h2>
          <div className="selector-controls">
            <label>
              Table:
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value as TableType)}
                className="table-select"
              >
                <option value="photo-no-risk">Phototherapy - No Risk Factors</option>
                <option value="photo-with-risk">Phototherapy - With Risk Factors</option>
                <option value="exchange-no-risk">Exchange Transfusion - No Risk Factors</option>
                <option value="exchange-with-risk">Exchange Transfusion - With Risk Factors</option>
              </select>
            </label>
            <label>
              Gestational Age:
              <select
                value={selectedGA}
                onChange={(e) => setSelectedGA(Number(e.target.value))}
                className="ga-select"
              >
                {availableGAs.map(ga => (
                  <option key={ga} value={ga}>
                    {ga >= 40 ? '≥40' : ga >= 38 && selectedTable.includes('with-risk') ? '≥38' : ga} weeks
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="threshold-table-section">
          <h3>{getTableTitle()}</h3>
          <p className="table-ref">Source: {getSupplementTableRef()} from AAP 2022 Supplementary Data</p>
          <p className="table-note">
            GA {selectedGA >= 40 ? '≥40' : selectedGA} weeks • Values in mg/dL
          </p>

          <div className="threshold-table-wrapper">
            <table className="threshold-table">
              <thead>
                <tr>
                  <th>Hour</th>
                  {Array.from({ length: 24 }, (_, i) => (
                    <th key={i}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayData.map(({ day, hours }) => (
                  <tr key={day}>
                    <td className="day-label">Day {day}<br /><small>({day * 24}-{day * 24 + 23}h)</small></td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const hourData = hours.find(hd => hd.hour === day * 24 + h);
                      return (
                        <td key={h} className="threshold-cell">
                          {hourData ? hourData.value.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="compact-view">
            <h4>Key Timepoints</h4>
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Age (hours)</th>
                  <th>Threshold (mg/dL)</th>
                </tr>
              </thead>
              <tbody>
                {[0, 12, 24, 36, 48, 72, 96, 120, 168, 336].map(hour => {
                  const value = hour < thresholds.length ? thresholds[hour] : thresholds[thresholds.length - 1];
                  return (
                    <tr key={hour}>
                      <td>{hour}h ({(hour / 24).toFixed(1)} days)</td>
                      <td>{value?.toFixed(1) || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="disclaimer-section">
          <h2>Important Notice</h2>
          <p>
            This tool is provided for <strong>decision support only</strong>. Always verify thresholds with the original AAP guideline and apply clinical judgment. Institutional protocols may differ from these recommendations.
          </p>
          <p>
            The threshold values displayed here are extracted from the AAP 2022 supplementary data tables. For the most accurate and up-to-date information, please refer to the original publication.
          </p>
        </section>
      </main>

      <footer className="tables-footer">
        <p>NeoCalc - AAP 2022 Reference Tables</p>
      </footer>
    </div>
  );
}
