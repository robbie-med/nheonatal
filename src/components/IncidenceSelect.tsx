import { EOSModelVersion } from '../types';
import { getIncidenceOptions } from '../calc/eos';

interface IncidenceSelectProps {
  modelVersion: EOSModelVersion;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Baseline incidence picker limited to the values KP's calculator offers for
 * the selected model, so each maps to KP's published intercept.
 */
export function IncidenceSelect({ modelVersion, value, onChange }: IncidenceSelectProps) {
  const options = getIncidenceOptions(modelVersion);
  const onList = options.some((o) => Math.abs(o - value) < 1e-9);

  return (
    <label className="stepper">
      <span className="stepper-label">Baseline incidence /1000</span>
      <div className="stepper-row">
        <select
          className="stepper-input"
          value={String(value)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        >
          {!onList && <option value={String(value)}>{value} (not a KP option)</option>}
          {options.map((o) => (
            <option key={o} value={String(o)}>{o}</option>
          ))}
        </select>
      </div>
    </label>
  );
}
