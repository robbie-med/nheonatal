import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PatientSelector } from './components/PatientSelector';
import { InputForm } from './components/InputForm';
import { ResultPanels } from './components/ResultPanels';
import { SnapshotsTable } from './components/SnapshotsTable';
import { TrendChart } from './charts/TrendChart';
import { useTheme } from './hooks/useTheme';
import { usePatients } from './hooks/usePatients';
import { useKPStatus } from './hooks/useKPStatus';
import { calculateEOS, getDefaultEOSInputs } from './calc/eos';
import { calculateBili, calculateBiliSync, getDefaultBiliInputs, calculateAgeHours } from './calc/bili';
import { formatEOSNote, formatBiliNote } from './format/asciiNotes';
import { exportAllData, importData } from './storage/db';
import { EOSInputs, EOSOutputs, BiliInputs, BiliOutputs, AppConfig } from './types';

// Default config (can be overridden by /public/config.json)
const DEFAULT_CONFIG: AppConfig = {
  eos: {
    baseline_incidence_per_1000: 0.5,
    recommendation_thresholds: {
      routine_max: 0.50,
      enhanced_max: 1.00,
      labs_max: 3.00
    }
  },
  bili: {
    api_enabled: true,
    api_base_url: 'https://peditools.org/bili2022/api/'
  },
  ui: {
    show_exchange_threshold: true,
    theme_default: 'light'
  }
};

export function App() {
  const { theme, effectiveTheme, toggleTheme } = useTheme();
  const {
    patients,
    selectedPatient,
    selectedPatientId,
    setSelectedPatientId,
    snapshots,
    loading: patientsLoading,
    error: patientsError,
    clearError,
    addPatient,
    renamePatient,
    removePatient,
    addSnapshot,
    removeSnapshot
  } = usePatients();
  const { status: kpStatus, loading: kpLoading } = useKPStatus();

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [eosInputs, setEOSInputs] = useState<EOSInputs>(() =>
    getDefaultEOSInputs(DEFAULT_CONFIG.eos.baseline_incidence_per_1000)
  );
  const [biliInputs, setBiliInputs] = useState<BiliInputs>(getDefaultBiliInputs);
  const [eosOutputs, setEOSOutputs] = useState<EOSOutputs | null>(null);
  const [biliOutputs, setBiliOutputs] = useState<BiliOutputs | null>(null);
  const [biliLoading, setBiliLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Load config on mount
  useEffect(() => {
    fetch('/nheonatal/config.json')
      .then(res => res.ok ? res.json() : DEFAULT_CONFIG)
      .then(cfg => setConfig({ ...DEFAULT_CONFIG, ...cfg }))
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  // Calculate EOS whenever inputs change
  useEffect(() => {
    const outputs = calculateEOS(eosInputs, config.eos.recommendation_thresholds);
    setEOSOutputs(outputs);
  }, [eosInputs, config.eos.recommendation_thresholds]);

  // Calculate Bili whenever inputs change
  useEffect(() => {
    let cancelled = false;

    const calculate = async () => {
      setBiliLoading(true);

      if (config.bili.api_enabled) {
        const outputs = await calculateBili(biliInputs, true);
        if (!cancelled) {
          setBiliOutputs(outputs);
          setApiAvailable(!outputs.isCached);
        }
      } else {
        const outputs = calculateBiliSync(biliInputs);
        if (!cancelled) {
          setBiliOutputs(outputs);
        }
      }

      if (!cancelled) {
        setBiliLoading(false);
      }
    };

    calculate();

    return () => {
      cancelled = true;
    };
  }, [biliInputs, config.bili.api_enabled]);

  // Update age hours when times change
  useEffect(() => {
    if (biliInputs.birthTime && biliInputs.sampleTime) {
      const ageHours = calculateAgeHours(biliInputs.birthTime, biliInputs.sampleTime);
      if (ageHours !== biliInputs.ageHours && ageHours >= 0) {
        setBiliInputs(prev => ({ ...prev, ageHours }));
      }
    }
  }, [biliInputs.birthTime, biliInputs.sampleTime]);

  // Sync GA between EOS and Bili inputs
  const handleEOSInputChange = useCallback((updates: Partial<EOSInputs>) => {
    setEOSInputs(prev => ({ ...prev, ...updates }));

    // Sync GA to bili
    if ('gestationalAgeWeeks' in updates || 'gestationalAgeDays' in updates) {
      setBiliInputs(prev => ({
        ...prev,
        gestationalAgeWeeks: updates.gestationalAgeWeeks ?? prev.gestationalAgeWeeks,
        gestationalAgeDays: updates.gestationalAgeDays ?? prev.gestationalAgeDays
      }));
    }
  }, []);

  const handleBiliInputChange = useCallback((updates: Partial<BiliInputs>) => {
    setBiliInputs(prev => ({ ...prev, ...updates }));

    // Sync GA to EOS
    if ('gestationalAgeWeeks' in updates || 'gestationalAgeDays' in updates) {
      setEOSInputs(prev => ({
        ...prev,
        gestationalAgeWeeks: updates.gestationalAgeWeeks ?? prev.gestationalAgeWeeks,
        gestationalAgeDays: updates.gestationalAgeDays ?? prev.gestationalAgeDays
      }));
    }
  }, []);

  // Save snapshot
  const handleSaveSnapshot = useCallback(async () => {
    if (!selectedPatient || !eosOutputs) return;

    const eosNote = formatEOSNote(selectedPatient.label, eosInputs, eosOutputs);
    const biliNote = biliOutputs
      ? formatBiliNote(selectedPatient.label, biliInputs, biliOutputs)
      : '';

    await addSnapshot(
      { eos: eosInputs, bili: biliInputs },
      { eos: eosOutputs, bili: biliOutputs },
      { eosNoteAscii: eosNote, biliNoteAscii: biliNote }
    );
  }, [selectedPatient, eosInputs, biliInputs, eosOutputs, biliOutputs, addSnapshot]);

  // Export data
  const handleExport = useCallback(async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neocalc-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    }
  }, []);

  // Import data
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importData(text);
        alert(`Imported ${result.patients} patients and ${result.snapshots} snapshots.`);
        window.location.reload();
      } catch (err) {
        console.error('Import failed:', err);
        alert('Import failed. Invalid file format.');
      }
    };
    input.click();
  }, []);

  return (
    <div className="app">
      <Header
        theme={theme}
        effectiveTheme={effectiveTheme}
        onToggleTheme={toggleTheme}
        kpStatus={kpStatus}
        kpLoading={kpLoading}
        onExport={handleExport}
        onImport={handleImport}
      />

      <main className="main-content">
        {patientsError && (
          <div className="error-banner" onClick={clearError}>
            {patientsError} (click to dismiss)
          </div>
        )}

        {!apiAvailable && (
          <div className="warning-banner">
            PediTools API unavailable. Using local threshold calculations.
          </div>
        )}

        <PatientSelector
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={setSelectedPatientId}
          onAddPatient={addPatient}
          onRenamePatient={renamePatient}
          onDeletePatient={removePatient}
          onSaveSnapshot={handleSaveSnapshot}
          canSave={!!selectedPatient && !!eosOutputs}
          loading={patientsLoading}
        />

        <InputForm
          eosInputs={eosInputs}
          biliInputs={biliInputs}
          onEOSChange={handleEOSInputChange}
          onBiliChange={handleBiliInputChange}
        />

        <ResultPanels
          patientLabel={selectedPatient?.label || 'No patient selected'}
          eosInputs={eosInputs}
          biliInputs={biliInputs}
          eosOutputs={eosOutputs}
          biliOutputs={biliOutputs}
          biliLoading={biliLoading}
          showExchangeThreshold={config.ui.show_exchange_threshold}
        />

        {snapshots.length > 0 && (
          <section className="section">
            <h2>Trend Chart</h2>
            <TrendChart snapshots={snapshots} />
          </section>
        )}

        <SnapshotsTable
          snapshots={snapshots}
          onDeleteSnapshot={removeSnapshot}
        />
      </main>

      <footer className="footer">
        <p>
          Decision support only. Verify with institutional protocol and clinical judgment.
          No PHI stored. Data remains on this device only.
        </p>
      </footer>
    </div>
  );
}
