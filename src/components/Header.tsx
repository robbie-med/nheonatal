import { KPStatus, Theme } from '../types';
import { getKPStatusColor, getKPStatusMessage } from '../monitor/kpMonitor';

interface HeaderProps {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  kpStatus: KPStatus | null;
  kpLoading: boolean;
  onExport: () => void;
  onImport: () => void;
  onShowTables?: () => void;
}

export function Header({
  effectiveTheme,
  onToggleTheme,
  kpStatus,
  kpLoading,
  onExport,
  onImport,
  onShowTables
}: HeaderProps) {
  const statusColor = kpStatus ? getKPStatusColor(kpStatus) : 'gray';
  const statusMessage = kpStatus ? getKPStatusMessage(kpStatus) : 'Checking KP status...';

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="app-title">NeoCalc</h1>
        <span className="app-subtitle">EOS + Bili Calculator</span>
      </div>

      <div className="header-center">
        <div className={`kp-status kp-status-${statusColor}`} title={statusMessage}>
          <span className={`status-dot status-${statusColor}`}></span>
          <span className="status-text">
            {kpLoading ? 'Checking...' : (
              kpStatus?.status === 'ok' ? 'KP Model OK' :
              kpStatus?.status === 'changed' ? 'KP Changed!' :
              'KP Unknown'
            )}
          </span>
        </div>
      </div>

      <div className="header-right">
        {onShowTables && (
          <button
            className="tables-link"
            onClick={onShowTables}
            title="View AAP 2022 threshold tables"
          >
            AAP Tables
          </button>
        )}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onImport}
          title="Import data from JSON file"
        >
          Import
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onExport}
          title="Export all data to JSON file"
        >
          Export
        </button>
        <button
          className="btn btn-icon"
          onClick={onToggleTheme}
          title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
        >
          {effectiveTheme === 'light' ? '🌙' : '☀️'}
          <span className="btn-label">{effectiveTheme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}
