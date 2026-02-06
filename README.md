# NeoCalc - Neonatal EOS + Hyperbilirubinemia Dual-Calculator

A single-page, static webapp for clinicians to calculate:
- **Neonatal Early-Onset Sepsis (EOS) Risk** using the Kaiser Permanente model (2017 or 2024)
- **AAP 2022 Hyperbilirubinemia Thresholds** via PediTools API

## Features

- Single patient form feeds both calculators instantly
- **Dual EOS model support**: 2017 and 2024 versions with different GBS Unknown handling
- Side-by-side result panels for EOS and Bilirubin
- Copy-ready ASCII notes for clinical documentation
- Local patient storage (IndexedDB) - unlimited records
- Trend charts for tracking values over time
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
  components/     # React UI components
  calc/          # EOS and Bili calculation modules
  storage/       # IndexedDB wrapper (Dexie)
  monitor/       # KP fingerprint checker
  format/        # ASCII note formatters
  charts/        # Trend chart component
  hooks/         # React hooks
  types/         # TypeScript interfaces
  styles/        # CSS with theme variables
public/
  config.json    # Runtime configuration
  kp_status.json # KP model status (auto-updated)
scripts/
  kp-scraper.py      # Python scraper for KP calculator calibration
  kp-scraper.ps1     # PowerShell scraper alternative
  kp_fingerprint.js  # CI script for KP monitoring
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

### Calibration

The calculator is calibrated from actual KP calculator outputs to achieve 1:1 parity. Scraper scripts in `/scripts` were used to collect test vectors from the KP site (with authorization).

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

## Scraper Scripts

The `/scripts` directory contains tools for calibrating the EOS calculator against the KP site:

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

Features:
- Handles ASP.NET AJAX UpdatePanel format
- Two-step form submission for 2024 model
- Rate-limited to 4 requests/minute
- CSV output with all input parameters and results

### kp-scraper.ps1 (PowerShell)

Windows-native alternative with similar functionality.

## Deployment

The app is deployed to GitHub Pages automatically via GitHub Actions when changes are pushed to `main`.

## Disclaimer

Decision support only. Verify with institutional protocol and clinical judgment.
No PHI stored. Data remains on the user's device only.

## License

MIT
