interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  inputMode?: 'numeric' | 'decimal';
}

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  decimals = 0,
  suffix,
  inputMode = 'numeric',
}: StepperProps) {
  const clamp = (v: number) => {
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  };

  const display = decimals > 0 ? value.toFixed(decimals) : String(value);

  return (
    <label className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChange(clamp(Math.round((value - step) * 1e4) / 1e4))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode={inputMode}
          className="stepper-input"
          value={display}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.\-]/g, '');
            if (raw === '' || raw === '-') {
              onChange(0);
              return;
            }
            const parsed = inputMode === 'decimal' ? parseFloat(raw) : parseInt(raw, 10);
            if (!Number.isNaN(parsed)) onChange(clamp(parsed));
          }}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChange(clamp(Math.round((value + step) * 1e4) / 1e4))}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
        {suffix && <span className="stepper-suffix">{suffix}</span>}
      </div>
    </label>
  );
}
