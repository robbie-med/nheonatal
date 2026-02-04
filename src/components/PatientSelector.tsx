import { useState } from 'react';
import { Patient } from '../types';

interface PatientSelectorProps {
  patients: Patient[];
  selectedPatientId: string | null;
  onSelectPatient: (id: string | null) => void;
  onAddPatient: (label: string) => Promise<Patient | null>;
  onRenamePatient: (id: string, label: string) => Promise<boolean>;
  onDeletePatient: (id: string) => Promise<boolean>;
  onSaveSnapshot: () => void;
  canSave: boolean;
  loading: boolean;
}

export function PatientSelector({
  patients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  onRenamePatient,
  onDeletePatient,
  onSaveSnapshot,
  canSave,
  loading
}: PatientSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await onAddPatient(newLabel.trim());
    setNewLabel('');
    setIsAdding(false);
  };

  const handleRename = async () => {
    if (!selectedPatientId || !newLabel.trim()) return;
    await onRenamePatient(selectedPatientId, newLabel.trim());
    setNewLabel('');
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (!selectedPatientId) return;
    const patient = patients.find(p => p.patientId === selectedPatientId);
    if (patient && confirm(`Delete patient "${patient.label}" and all their snapshots?`)) {
      await onDeletePatient(selectedPatientId);
    }
  };

  const startRename = () => {
    const patient = patients.find(p => p.patientId === selectedPatientId);
    if (patient) {
      setNewLabel(patient.label);
      setIsRenaming(true);
      setIsAdding(false);
    }
  };

  const startAdd = () => {
    setNewLabel('');
    setIsAdding(true);
    setIsRenaming(false);
  };

  if (loading) {
    return (
      <section className="section patient-selector">
        <div className="loading">Loading patients...</div>
      </section>
    );
  }

  return (
    <section className="section patient-selector">
      <div className="patient-row">
        <div className="patient-select-group">
          <label htmlFor="patient-select">Patient:</label>
          <select
            id="patient-select"
            value={selectedPatientId || ''}
            onChange={(e) => onSelectPatient(e.target.value || null)}
            className="patient-dropdown"
          >
            <option value="">-- Select Patient --</option>
            {patients.map(p => (
              <option key={p.patientId} value={p.patientId}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="patient-actions">
          {!isAdding && !isRenaming && (
            <>
              <button className="btn btn-primary btn-sm" onClick={startAdd}>
                New
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={startRename}
                disabled={!selectedPatientId}
              >
                Rename
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={!selectedPatientId}
              >
                Delete
              </button>
            </>
          )}

          {(isAdding || isRenaming) && (
            <div className="patient-input-group">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={isAdding ? 'Patient identifier...' : 'New name...'}
                className="input-text"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    isAdding ? handleAdd() : handleRename();
                  } else if (e.key === 'Escape') {
                    setIsAdding(false);
                    setIsRenaming(false);
                  }
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={isAdding ? handleAdd : handleRename}
              >
                {isAdding ? 'Add' : 'Save'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setIsAdding(false); setIsRenaming(false); }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="snapshot-action">
          <button
            className="btn btn-success"
            onClick={onSaveSnapshot}
            disabled={!canSave}
            title={canSave ? 'Save current values as a snapshot' : 'Select a patient first'}
          >
            Save Snapshot
          </button>
        </div>
      </div>
    </section>
  );
}
