interface ChipOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface ChipGroupProps<T extends string> {
  label?: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  ariaLabel,
}: ChipGroupProps<T>) {
  return (
    <div className="chipgroup">
      {label && <div className="chipgroup-label">{label}</div>}
      <div className="chipgroup-row" role="radiogroup" aria-label={ariaLabel ?? label}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`chip${selected ? ' chip-on' : ''}`}
              onClick={() => onChange(opt.value)}
              title={opt.hint}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
