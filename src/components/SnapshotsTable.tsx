import { Snapshot } from '../types';
import { formatDateCompact } from '../format/asciiNotes';

interface SnapshotsTableProps {
  snapshots: Snapshot[];
  onDeleteSnapshot: (id: string) => void;
}

export function SnapshotsTable({ snapshots, onDeleteSnapshot }: SnapshotsTableProps) {
  if (snapshots.length === 0) {
    return null;
  }

  const handleDelete = (snapshot: Snapshot) => {
    if (confirm(`Delete snapshot from ${formatDateCompact(snapshot.timestamp)}?`)) {
      onDeleteSnapshot(snapshot.snapshotId);
    }
  };

  return (
    <section className="section snapshots-table">
      <h2>Saved Snapshots</h2>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>GA</th>
              <th>EOS Risk</th>
              <th>TSB</th>
              <th>Photo Threshold</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.slice().reverse().map(snapshot => (
              <tr key={snapshot.snapshotId}>
                <td>{formatDateCompact(snapshot.timestamp)}</td>
                <td>
                  {snapshot.inputs.eos.gestationalAgeWeeks}w{snapshot.inputs.eos.gestationalAgeDays}d
                </td>
                <td>
                  {snapshot.outputs.eos
                    ? `${snapshot.outputs.eos.riskPosterior.toFixed(2)}/1000`
                    : '-'}
                </td>
                <td>
                  {snapshot.inputs.bili.tsbValue.toFixed(1)} mg/dL
                </td>
                <td>
                  {snapshot.outputs.bili
                    ? `${snapshot.outputs.bili.photoThreshold.toFixed(1)} mg/dL`
                    : '-'}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => handleDelete(snapshot)}
                    title="Delete this snapshot"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
