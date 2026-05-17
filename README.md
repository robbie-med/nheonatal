# NeoCalc - Neonatal EOS + Hyperbilirubinemia Dual-Calculator

A single-page, static webapp for clinicians to calculate:
- **Neonatal Early-Onset Sepsis (EOS) Risk** using the Kaiser Permanente model (2017 or 2024)
- **AAP 2022 Hyperbilirubinemia Thresholds** via PediTools API

## Features

- Speed-optimized UI: chip-based segmented controls and +/- steppers for fast entry on touch or desktop
- Two custom layouts selected by viewport:
  - **Mobile** — single scroll, sticky bottom dock with combined EOS + bili result and one-tap Copy
  - **Desktop** — inputs on the left, sticky results card and copyable note on the right
- **Dual EOS model support**: 2017 and 2024 versions, ported from the published KP logistic regression
- Combined EOS + bilirubin ASCII note with a single Copy button
- Optional clock-based age entry (birth time + sample time auto-derive age in hours)
- "Next baby" reset clears all inputs and defaults age to 18h
- Local patient storage (IndexedDB) and trend charts behind a slide-out drawer
- Light/Dark mode with persistent preference
- KP model change monitoring via GitHub Actions
- Fully static - runs on GitHub Pages with no backend

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
  components/      # React UI components (MobileShell, DesktopShell, ChipGroup, Stepper, ...)
  calc/            # EOS regression port + Bili threshold calc
  storage/         # IndexedDB wrapper (Dexie)
  monitor/         # KP fingerprint checker
  format/          # ASCII note formatters (incl. combined note)
  charts/          # Trend chart component
  hooks/           # React hooks (useBreakpoint, useTheme, usePatients, ...)
  types/           # TypeScript interfaces
  styles/          # CSS with theme variables + shells.css for layout
public/
  config.json      # Runtime configuration
  kp_status.json   # KP model status (auto-updated)
scripts/
  kp-scraper.py        # Python scraper for KP calculator
  kp-scraper.ps1       # PowerShell scraper alternative
  scrape_2017.py       # 2017-model scrape helper
  scrape_2017_abx.py   # 2017 IAP-coefficient scrape helper
  fit_eos_regression.py# Fits logistic-regression coefficients from scraped data
  eos_coefficients.json# Fitted 2017 + 2024 coefficients consumed by src/calc/eos.ts
  kp_fingerprint.js    # CI script for KP monitoring
kp-eos-data.csv        # Scraped KP verification vectors used by tests
```

## Configuration

Edit `public/config.json` to customize:
- EOS baseline incidence
- Recommendation thresholds
- Enable/disable PediTools API
- Show/hide exchange thresholds
- Default theme

## EOS Calculator

Implements the Kaiser Permanente Early-Onset Sepsis model with support for both the **2017** and **2024** versions.

### Model Versions

| Feature | 2017 Model | 2024 Model |
|---------|------------|------------|
| Base risk (40w, 98°F, 0 ROM, GBS neg) | 0.02/1000 | 0.07/1000 |
| GBS Unknown OR | ~1.0 (same as negative) | ~3.14 (3x higher risk) |
| LR Clinical Illness | 21.2 | 14.5 |
| LR Well Appearing | 0.41 | 0.36 |

**Key Difference**: The 2024 model assigns significantly higher risk to GBS Unknown status, treating it closer to GBS Positive rather than GBS Negative.

### Implementation

`src/calc/eos.ts` is a direct port of the Kuzniewicz/Puopolo logistic regression: prior log-odds are computed from gestational age (cubic basis centered at 39.5w), highest maternal temperature, ROM (transformed as `(h+0.05)^0.2`), GBS status, and intrapartum antibiotics; the baseline-incidence offset rescales the prior odds; then the published clinical-exam likelihood ratios produce the posterior risk.

Coefficients live in [scripts/eos_coefficients.json](scripts/eos_coefficients.json) and are fitted from KP web outputs scraped into [kp-eos-data.csv](kp-eos-data.csv) via [scripts/fit_eos_regression.py](scripts/fit_eos_regression.py). The test suite (`src/calc/eos.test.ts`) pins the implementation against those vectors — including the reference case 39w0d / 37.0°C / ROM 12h / GBS− / no abx / baseline 0.5 → **0.29/1000 at birth**, **0.10 / 1.06 / 4.19 post-exam**.

### References

- Escobar GJ, et al. JAMA Pediatr. 2014
- Kuzniewicz MW, et al. Pediatrics. 2017
- Kuzniewicz MW, et al. Pediatrics. 2024 (updated model)

### Inputs

- Model version (2017 or 2024)
- Gestational age (weeks + days)
- Maternal temperature
- ROM duration (hours)
- GBS status (Negative, Positive, Unknown)
- Intrapartum antibiotics (type and duration)
- Clinical examination (Well, Equivocal, Clinical Illness)
- Baseline incidence (per 1000 live births)

### Outputs

- Risk at birth (per 1000)
- Post-exam risk (per 1000)
- Recommendation category (Routine, Blood Culture, Empiric Antibiotics)

## Bilirubin Calculator

Uses the PediTools bili2022 API for AAP 2022 guidelines.
Falls back to local calculations if API is unavailable.

### Inputs

- Gestational age
- Age in hours
- TSB value
- Neurotoxicity risk factors

### Outputs

- Phototherapy threshold
- Exchange threshold
- Follow-up guidance

## KP Model Monitor

A GitHub Action runs daily to check if the KP EOS reference page has changed.
If changes are detected:
1. Updates `public/kp_status.json`
2. Creates a GitHub Issue for review

## Scraper & Fitting Scripts

The `/scripts` directory contains the pipeline used to fit the EOS regression against the KP site:

1. **Scrape** verification vectors with `kp-scraper.py`, `scrape_2017.py`, or `scrape_2017_abx.py` (rate-limited; honors KP terms of use). Output → `kp-eos-data.csv`.
2. **Fit** the logistic-regression coefficients with `fit_eos_regression.py`. Output → `scripts/eos_coefficients.json`, which is imported by `src/calc/eos.ts`.
3. **Validate** with `npm test` — the test suite asserts the implementation matches the scraped table.

### kp-scraper.py (Python)

```bash
# Basic usage (2017 model)
python scripts/kp-scraper.py

# 2024 model
python scripts/kp-scraper.py --model 2024

# Skip SSL verification (Windows)
python scripts/kp-scraper.py --no-verify-ssl

# Custom output file
python scripts/kp-scraper.py --output results.csv
```

Handles ASP.NET AJAX UpdatePanel format and the 2024-model two-step submission. `kp-scraper.ps1` is a Windows-native PowerShell equivalent.

## Deployment

The app is deployed to GitHub Pages automatically via GitHub Actions when changes are pushed to `main`.

## Disclaimer

Decision support only. Verify with institutional protocol and clinical judgment.
No PHI stored. Data remains on the user's device only.

## License

MIT
