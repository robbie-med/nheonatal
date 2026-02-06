# KP Calculator Verification Test Vectors

Use these specific input combinations to verify against the Kaiser Permanente EOS Calculator.
For each case, record the "Risk at Birth" and "Risk after Clinical Exam" values from the KP site.

## Instructions

1. Go to: https://neonatalsepsiscalculator.kaiserpermanente.org/
2. For each test case below, enter the inputs and record the outputs
3. Compare against our calculator to identify any systematic differences

---

## Test Cases

### Base Case (Isolate Intercept)

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 1 | 2017 | 40w0d | 98.0 | 0 | Negative | None | Well | Base intercept |
| 2 | 2024 | 40w0d | 98.0 | 0 | Negative | None | Well | Base intercept |

### Temperature Sensitivity

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 3 | 2017 | 40w0d | 99.0 | 0 | Negative | None | Well | Temp +1°F |
| 4 | 2017 | 40w0d | 100.0 | 0 | Negative | None | Well | Temp +2°F |
| 5 | 2017 | 40w0d | 101.0 | 0 | Negative | None | Well | Temp +3°F |
| 6 | 2024 | 40w0d | 100.0 | 0 | Negative | None | Well | 2024 temp |

### ROM Sensitivity

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 7 | 2017 | 40w0d | 98.0 | 12 | Negative | None | Well | ROM below threshold |
| 8 | 2017 | 40w0d | 98.0 | 24 | Negative | None | Well | ROM above threshold |
| 9 | 2017 | 40w0d | 98.0 | 48 | Negative | None | Well | Prolonged ROM |

### GBS Status Sensitivity (KEY DIFFERENCE)

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 10 | 2017 | 40w0d | 98.0 | 0 | Positive | None | Well | GBS+ 2017 |
| 11 | 2017 | 40w0d | 98.0 | 0 | Unknown | None | Well | GBS Unk 2017 (OR≈1.04) |
| 12 | 2024 | 40w0d | 98.0 | 0 | Positive | None | Well | GBS+ 2024 |
| 13 | 2024 | 40w0d | 98.0 | 0 | Unknown | None | Well | GBS Unk 2024 (OR≈3.12) |

### GA Sensitivity

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 14 | 2017 | 35w0d | 98.0 | 0 | Negative | None | Well | Preterm |
| 15 | 2017 | 37w0d | 98.0 | 0 | Negative | None | Well | Early term |
| 16 | 2017 | 39w0d | 98.0 | 0 | Negative | None | Well | Full term |

### Clinical Exam (Likelihood Ratio)

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|--------------|
| 17 | 2017 | 40w0d | 100.0 | 0 | Negative | None | Equivocal | LR equivocal 2017 |
| 18 | 2017 | 40w0d | 100.0 | 0 | Negative | None | Clinical Illness | LR ill 2017 (21.2) |
| 19 | 2024 | 40w0d | 100.0 | 0 | Negative | None | Clinical Illness | LR ill 2024 (14.5) |

### Antibiotics

| # | Model | GA | Temp(°F) | ROM(h) | GBS | Abx | Duration | Clinical | Expected Use |
|---|-------|-----|----------|--------|-----|-----|----------|----------|--------------|
| 20 | 2017 | 40w0d | 98.0 | 0 | Positive | GBS-specific | ≥4h | Well | Abx effect |
| 21 | 2017 | 40w0d | 98.0 | 0 | Positive | Broad spectrum | ≥4h | Well | Broad abx |

---

## Recording Template

Copy this for each test case:

```
Test #:
Model Version:
Inputs: GA=, Temp=, ROM=, GBS=, Abx=, Clinical=

KP Calculator Results:
  Risk at Birth:
  Risk after Clinical Exam:

Our Calculator Results:
  Risk at Birth:
  Risk after Clinical Exam:

Difference:
  Birth:
  Posterior:
```

---

## Analysis Notes

After collecting data, look for:

1. **Constant offset** - If all values differ by same factor, adjust intercept
2. **Temperature pattern** - Linear vs categorical coefficient
3. **ROM pattern** - Transformation function (likely (hours+0.05)^0.2)
4. **GBS Unknown ratio** - Verify 2017 OR≈1.04 vs 2024 OR≈3.12
5. **Clinical LR ratio** - Verify 2017 LR=21.2 vs 2024 LR=14.5
