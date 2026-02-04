# NeoCalc - Neonatal EOS + Hyperbilirubinemia Dual-Calculator

A single-page, static webapp for clinicians to calculate:
- **Neonatal Early-Onset Sepsis (EOS) Risk** using the Kaiser Permanente model
- **AAP 2022 Hyperbilirubinemia Thresholds** via PediTools API

## Features

- Single patient form feeds both calculators instantly
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

Implements the Kaiser Permanente Early-Onset Sepsis model based on:
- Escobar GJ, et al. JAMA Pediatr. 2014
- Kuzniewicz MW, et al. Pediatrics. 2017

Inputs:
- Gestational age
- Maternal temperature
- ROM duration
- GBS status
- Intrapartum antibiotics
- Clinical examination

Outputs:
- Risk at birth (per 1000)
- Post-exam risk (per 1000)
- Recommendation category

## Bilirubin Calculator

Uses the PediTools bili2022 API for AAP 2022 guidelines.
Falls back to local calculations if API is unavailable.

Inputs:
- Gestational age
- Age in hours
- TSB value
- Neurotoxicity risk factors

Outputs:
- Phototherapy threshold
- Exchange threshold
- Follow-up guidance

## KP Model Monitor

A GitHub Action runs daily to check if the KP EOS reference page has changed.
If changes are detected:
1. Updates `public/kp_status.json`
2. Creates a GitHub Issue for review

## Deployment

The app is deployed to GitHub Pages automatically via GitHub Actions when changes are pushed to `main`.

## Disclaimer

Decision support only. Verify with institutional protocol and clinical judgment.
No PHI stored. Data remains on the user's device only.

## License

MIT
