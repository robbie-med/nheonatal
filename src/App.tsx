import { useState, useEffect, useCallback } from 'react';
import { MobileShell } from './components/MobileShell';
import { DesktopShell } from './components/DesktopShell';
import { MenuDrawer } from './components/MenuDrawer';
import { PatientSelector } from './components/PatientSelector';
import { SnapshotsTable } from './components/SnapshotsTable';
import { TrendChart } from './charts/TrendChart';
import { ThresholdTables } from './pages/ThresholdTables';
import { useTheme } from './hooks/useTheme';
import { usePatients } from './hooks/usePatients';
import { useKPStatus } from './hooks/useKPStatus';
import { useBreakpoint } from './hooks/useBreakpoint';
import { calculateEOS, getDefaultEOSInputs } from './calc/eos';
import { calculateBili, calculateBiliSync, getDefaultBiliInputs, calculateAgeHours } from './calc/bili';
import { formatEOSNote, formatBiliNote } from './format/asciiNotes';
import { exportAllData, importData } from './storage/db';
import { EOSInputs, EOSOutputs, BiliInputs, BiliOutputs, AppConfig } from './types';

type Page = 'calculator' | 'tables';

const DEFAULT_CONFIG: AppConfig = {
  eos: {
    baseline_incidence_per_1000: 0.5,
    recommendation_thresholds: {
      routine_max: 0.50,
      enhanced_max: 1.00,
      labs_max: 3.00,
    },
  },
  bili: {
    api_enabled: false,
    api_base_url: 'https://peditools.org/bili2022/api/',
  },
  ui: {
    show_exchange_threshold: true,
    theme_default: 'light',
  },
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
    removeSnapshot,
  } = usePatients();
  const { status: kpStatus, loading: kpLoading } = useKPStatus();
  const { isMobile } = useBreakpoint();

  const [currentPage, setCurrentPage] = useState<Page>('calculator');
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [eosInputs, setEOSInputs] = useState<EOSInputs>(() =>
    getDefaultEOSInputs(DEFAULT_CONFIG.eos.baseline_incidence_per_1000)
  );
  const [biliInputs, setBiliInputs] = useState<BiliInputs>(getDefaultBiliInputs);
  const [eosOutputs, setEOSOutputs] = useState<EOSOutputs | null>(null);
  const [biliOutputs, setBiliOutputs] = useState<BiliOutputs | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/config.json')
      .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
      .then((cfg) => setConfig({ ...DEFAULT_CONFIG, ...cfg }))
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  useEffect(() => {
    const outputs = calculateEOS(eosInputs, config.eos.recommendation_thresholds);
    setEOSOutputs(outputs);
  }, [eosInputs, config.eos.recommendation_thresholds]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (config.bili.api_enabled) {
        const outputs = await calculateBili(biliInputs, true);
        if (!cancelled) {
          setBiliOutputs(outputs);
          setApiAvailable(!outputs.isCached);
        }
      } else {
        const outputs = calculateBiliSync(biliInputs);
        if (!cancelled) setBiliOutputs(outputs);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [biliInputs, config.bili.api_enabled]);

  useEffect(() => {
    if (biliInputs.birthTime && biliInputs.sampleTime) {
      const ageHours = calculateAgeHours(biliInputs.birthTime, biliInputs.sampleTime);
      if (ageHours !== biliInputs.ageHours && ageHours >= 0) {
        setBiliInputs((prev) => ({ ...prev, ageHours }));
      }
    }
  }, [biliInputs.birthTime, biliInputs.sampleTime]);

  const handleEOSChange = useCallback((updates: Partial<EOSInputs>) => {
    setEOSInputs((prev) => ({ ...prev, ...updates }));
    if ('gestationalAgeWeeks' in updates || 'gestationalAgeDays' in updates) {
      setBiliInputs((prev) => ({
        ...prev,
        gestationalAgeWeeks: updates.gestationalAgeWeeks ?? prev.gestationalAgeWeeks,
        gestationalAgeDays: updates.gestationalAgeDays ?? prev.gestationalAgeDays,
      }));
    }
  }, []);

  const handleBiliChange = useCallback((updates: Partial<BiliInputs>) => {
    setBiliInputs((prev) => ({ ...prev, ...updates }));
    if ('gestationalAgeWeeks' in updates || 'gestationalAgeDays' in updates) {
      setEOSInputs((prev) => ({
        ...prev,
        gestationalAgeWeeks: updates.gestationalAgeWeeks ?? prev.gestationalAgeWeeks,
        gestationalAgeDays: updates.gestationalAgeDays ?? prev.gestationalAgeDays,
      }));
    }
  }, []);

  const handleResetAll = useCallback(() => {
    setEOSInputs(getDefaultEOSInputs(config.eos.baseline_incidence_per_1000));
    setBiliInputs(getDefaultBiliInputs());
    setSelectedPatientId(null);
  }, [config.eos.baseline_incidence_per_1000, setSelectedPatientId]);

  const handleSaveSnapshot = useCallback(async () => {
    if (!selectedPatient || !eosOutputs) return;
    const eosNote = formatEOSNote(selectedPatient.label, eosInputs, eosOutputs);
    const biliNote = biliOutputs ? formatBiliNote(selectedPatient.label, biliInputs, biliOutputs) : '';
    await addSnapshot(
      { eos: eosInputs, bili: biliInputs },
      { eos: eosOutputs, bili: biliOutputs },
      { eosNoteAscii: eosNote, biliNoteAscii: biliNote }
    );
  }, [selectedPatient, eosInputs, biliInputs, eosOutputs, biliOutputs, addSnapshot]);

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

  if (currentPage === 'tables') {
    return <ThresholdTables onBack={() => setCurrentPage('calculator')} />;
  }

  const patientLabel = selectedPatient?.label ?? '';
  const shellProps = {
    eosInputs,
    biliInputs,
    eosOutputs,
    biliOutputs,
    onEOSChange: handleEOSChange,
    onBiliChange: handleBiliChange,
    onOpenMenu: () => setMenuOpen(true),
    onResetAll: handleResetAll,
    patientLabel,
  };

  return (
    <div className="app" data-mode={isMobile ? 'mobile' : 'desktop'}>
      {isMobile ? <MobileShell {...shellProps} /> : <DesktopShell {...shellProps} />}

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="drawer-content">
          <h3>Settings</h3>

          <div className="drawer-section">
            <div className="drawer-row">
              <span>Theme</span>
              <button className="d-btn d-btn-ghost" onClick={toggleTheme}>
                {effectiveTheme === 'dark' ? '☀ Light' : '☾ Dark'} ({theme})
              </button>
            </div>
            <div className="drawer-row">
              <span>KP calculator status</span>
              <span className="drawer-status">
                {kpLoading ? 'checking…' : kpStatus?.status ?? 'unknown'}
              </span>
            </div>
          </div>

          <div className="drawer-section">
            <h4>Patient (optional)</h4>
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
            {patientsError && (
              <div className="error-banner" onClick={clearError}>
                {patientsError} (tap to dismiss)
              </div>
            )}
          </div>

          {snapshots.length > 0 && (
            <div className="drawer-section">
              <h4>Trend</h4>
              <TrendChart snapshots={snapshots} />
              <SnapshotsTable snapshots={snapshots} onDeleteSnapshot={removeSnapshot} />
            </div>
          )}

          <div className="drawer-section">
            <h4>Data</h4>
            <div className="drawer-row drawer-row-buttons">
              <button className="d-btn d-btn-ghost" onClick={handleExport}>Export</button>
              <button className="d-btn d-btn-ghost" onClick={handleImport}>Import</button>
              <button className="d-btn d-btn-ghost" onClick={() => setCurrentPage('tables')}>
                Threshold tables
              </button>
            </div>
            {config.bili.api_enabled && !apiAvailable && (
              <div className="warning-banner">
                PediTools API unavailable. Using local AAP 2022 tables.
              </div>
            )}
          </div>
        </div>
      </MenuDrawer>
    </div>
  );
}
