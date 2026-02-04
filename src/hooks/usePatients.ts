import { useState, useEffect, useCallback } from 'react';
import { Patient, Snapshot } from '../types';
import {
  getAllPatients,
  createPatient,
  updatePatientLabel,
  deletePatient,
  getPatientSnapshots,
  createSnapshot,
  deleteSnapshot
} from '../storage/db';

/**
 * Custom hook for managing patients and their snapshots
 */
export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  // Load snapshots when patient changes
  useEffect(() => {
    if (selectedPatientId) {
      loadSnapshots(selectedPatientId);
    } else {
      setSnapshots([]);
    }
  }, [selectedPatientId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const loadedPatients = await getAllPatients();
      setPatients(loadedPatients);

      // Auto-select first patient if none selected
      if (loadedPatients.length > 0 && !selectedPatientId) {
        setSelectedPatientId(loadedPatients[0].patientId);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load patients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshots = async (patientId: string) => {
    try {
      const loadedSnapshots = await getPatientSnapshots(patientId);
      setSnapshots(loadedSnapshots);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
      setSnapshots([]);
    }
  };

  const addPatient = useCallback(async (label: string): Promise<Patient | null> => {
    try {
      const patient = await createPatient(label);
      setPatients(prev => [patient, ...prev]);
      setSelectedPatientId(patient.patientId);
      return patient;
    } catch (err) {
      setError('Failed to create patient');
      console.error(err);
      return null;
    }
  }, []);

  const renamePatient = useCallback(async (patientId: string, label: string): Promise<boolean> => {
    try {
      await updatePatientLabel(patientId, label);
      setPatients(prev =>
        prev.map(p =>
          p.patientId === patientId
            ? { ...p, label, updatedAt: new Date().toISOString() }
            : p
        )
      );
      return true;
    } catch (err) {
      setError('Failed to rename patient');
      console.error(err);
      return false;
    }
  }, []);

  const removePatient = useCallback(async (patientId: string): Promise<boolean> => {
    try {
      await deletePatient(patientId);
      setPatients(prev => prev.filter(p => p.patientId !== patientId));

      if (selectedPatientId === patientId) {
        const remaining = patients.filter(p => p.patientId !== patientId);
        setSelectedPatientId(remaining.length > 0 ? remaining[0].patientId : null);
      }

      return true;
    } catch (err) {
      setError('Failed to delete patient');
      console.error(err);
      return false;
    }
  }, [patients, selectedPatientId]);

  const addSnapshot = useCallback(async (
    inputs: Snapshot['inputs'],
    outputs: Snapshot['outputs'],
    notes: Snapshot['notes']
  ): Promise<Snapshot | null> => {
    if (!selectedPatientId) {
      setError('No patient selected');
      return null;
    }

    try {
      const snapshot = await createSnapshot(selectedPatientId, inputs, outputs, notes);
      setSnapshots(prev => [...prev, snapshot]);
      return snapshot;
    } catch (err) {
      setError('Failed to save snapshot');
      console.error(err);
      return null;
    }
  }, [selectedPatientId]);

  const removeSnapshot = useCallback(async (snapshotId: string): Promise<boolean> => {
    try {
      await deleteSnapshot(snapshotId);
      setSnapshots(prev => prev.filter(s => s.snapshotId !== snapshotId));
      return true;
    } catch (err) {
      setError('Failed to delete snapshot');
      console.error(err);
      return false;
    }
  }, []);

  const selectedPatient = patients.find(p => p.patientId === selectedPatientId) || null;

  return {
    patients,
    selectedPatient,
    selectedPatientId,
    setSelectedPatientId,
    snapshots,
    loading,
    error,
    clearError: () => setError(null),
    addPatient,
    renamePatient,
    removePatient,
    addSnapshot,
    removeSnapshot,
    refreshPatients: loadPatients
  };
}
