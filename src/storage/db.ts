import Dexie, { Table } from 'dexie';
import { Patient, Snapshot } from '../types';

// UUID generator with fallback for older browsers
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class NeoCalcDB extends Dexie {
  patients!: Table<Patient, string>;
  snapshots!: Table<Snapshot, string>;

  constructor() {
    super('NeoCalcDB');
    this.version(1).stores({
      patients: 'patientId, label, createdAt, updatedAt',
      snapshots: 'snapshotId, patientId, timestamp'
    });
  }
}

export const db = new NeoCalcDB();

// Patient operations
export async function createPatient(label: string): Promise<Patient> {
  const patient: Patient = {
    patientId: generateUUID(),
    label,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.patients.add(patient);
  return patient;
}

export async function getAllPatients(): Promise<Patient[]> {
  return db.patients.orderBy('updatedAt').reverse().toArray();
}

export async function getPatient(patientId: string): Promise<Patient | undefined> {
  return db.patients.get(patientId);
}

export async function updatePatientLabel(patientId: string, label: string): Promise<void> {
  await db.patients.update(patientId, {
    label,
    updatedAt: new Date().toISOString()
  });
}

export async function deletePatient(patientId: string): Promise<void> {
  await db.transaction('rw', [db.patients, db.snapshots], async () => {
    await db.snapshots.where('patientId').equals(patientId).delete();
    await db.patients.delete(patientId);
  });
}

// Snapshot operations
export async function createSnapshot(
  patientId: string,
  inputs: Snapshot['inputs'],
  outputs: Snapshot['outputs'],
  notes: Snapshot['notes']
): Promise<Snapshot> {
  const snapshot: Snapshot = {
    snapshotId: generateUUID(),
    patientId,
    timestamp: new Date().toISOString(),
    inputs,
    outputs,
    notes
  };
  await db.snapshots.add(snapshot);
  await db.patients.update(patientId, {
    updatedAt: new Date().toISOString()
  });
  return snapshot;
}

export async function getPatientSnapshots(patientId: string): Promise<Snapshot[]> {
  return db.snapshots
    .where('patientId')
    .equals(patientId)
    .sortBy('timestamp');
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await db.snapshots.delete(snapshotId);
}

// Export/Import operations
export async function exportAllData(): Promise<string> {
  const patients = await db.patients.toArray();
  const snapshots = await db.snapshots.toArray();
  return JSON.stringify({ patients, snapshots, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importData(jsonString: string): Promise<{ patients: number; snapshots: number }> {
  const data = JSON.parse(jsonString);
  let patientsImported = 0;
  let snapshotsImported = 0;

  await db.transaction('rw', [db.patients, db.snapshots], async () => {
    if (data.patients && Array.isArray(data.patients)) {
      for (const patient of data.patients) {
        const existing = await db.patients.get(patient.patientId);
        if (!existing) {
          await db.patients.add(patient);
          patientsImported++;
        }
      }
    }
    if (data.snapshots && Array.isArray(data.snapshots)) {
      for (const snapshot of data.snapshots) {
        const existing = await db.snapshots.get(snapshot.snapshotId);
        if (!existing) {
          await db.snapshots.add(snapshot);
          snapshotsImported++;
        }
      }
    }
  });

  return { patients: patientsImported, snapshots: snapshotsImported };
}
