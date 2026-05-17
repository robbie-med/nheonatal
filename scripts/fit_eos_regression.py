#!/usr/bin/env python3
"""
Fit logistic-regression coefficients to scraped KP EOS data.

KP EOS model is a multivariable logistic regression on log-odds:
    logit(p) = beta0 + beta_GA * g(GA) + beta_T * (TempF - 98)
             + beta_ROM * h(ROM) + beta_GBS_status + beta_abx_status
             + log(incidence / 0.5)   # baseline offset

where:
  - h(ROM) = (ROM + 0.05)^0.2   (Kuzniewicz published transform)
  - g(GA)  = piecewise/quadratic; we fit as cubic in (GA - 39.5)
  - GBS and abx are categorical dummies (Negative / none as reference)

Output: coefficients for 2017 and 2024 models written to
        scripts/eos_coefficients.json
"""

import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

INPUT_CSV = Path(__file__).parent.parent / "kp-eos-data.csv"
OUTPUT_JSON = Path(__file__).parent / "eos_coefficients.json"


def rom_transform(rom_hours):
    return (rom_hours + 0.05) ** 0.2


def ga_basis(ga):
    """Cubic basis around 39.5 weeks (lookup minimum)."""
    x = ga - 39.5
    return [x, x * x, x * x * x]


def risk_to_logit(risk_per_1000):
    p = risk_per_1000 / 1000.0
    return math.log(p / (1 - p))


def parse_rows(rows, model_version):
    """Return list of (logit, feature_vector, label) tuples for the model."""
    out = []
    for r in rows:
        if r["Model"] != model_version:
            continue
        try:
            risk = float(r["KP_RiskAtBirth"])
        except (ValueError, KeyError):
            continue
        if risk <= 0:
            continue

        ga = float(r["GA_Weeks"]) + float(r["GA_Days"]) / 7.0
        temp_f = float(r["Temp_F"])
        rom = float(r["ROM_Hours"])
        gbs = r["GBS_Status"]
        abx = r["Antibiotics"]

        # Feature vector: intercept, T-98, h(ROM)-h(0), GA basis, GBS dummies, abx dummies
        feats = [
            1.0,                       # intercept
            temp_f - 98.0,             # temp
            rom_transform(rom) - rom_transform(0),  # rom
        ]
        feats.extend(ga_basis(ga))     # GA cubic basis (3 terms)
        # GBS dummies: positive, unknown (negative is reference)
        feats.append(1.0 if gbs == "Positive" else 0.0)
        feats.append(1.0 if gbs == "Unknown" else 0.0)
        # Antibiotic dummies: broad4, broad2, gbs2 (none is reference)
        feats.append(1.0 if abx == "broad4" else 0.0)
        feats.append(1.0 if abx == "broad2" else 0.0)
        feats.append(1.0 if abx == "gbs2" else 0.0)

        y = risk_to_logit(risk)
        out.append((y, feats, r))
    return out


FEATURE_NAMES = [
    "intercept",
    "beta_temp_perF",
    "beta_rom_per_h_transform",
    "beta_ga_linear",
    "beta_ga_quadratic",
    "beta_ga_cubic",
    "beta_gbs_positive",
    "beta_gbs_unknown",
    "beta_abx_broad4",
    "beta_abx_broad2",
    "beta_abx_gbs2",
]


def fit_model(rows, model_version):
    data = parse_rows(rows, model_version)
    if not data:
        print(f"No data for {model_version}")
        return None

    Y = np.array([d[0] for d in data])
    X = np.array([d[1] for d in data])

    # Solve via least squares (linear in betas)
    beta, residuals, rank, sv = np.linalg.lstsq(X, Y, rcond=None)
    Y_pred = X @ beta
    resid_std = np.std(Y - Y_pred)

    print(f"\n=== Model {model_version} ===")
    print(f"  N = {len(data)} cases")
    print(f"  Residual logit std: {resid_std:.4f}")
    print("  Coefficients:")
    for name, b in zip(FEATURE_NAMES, beta):
        print(f"    {name:30s} = {b:+.5f}")

    # Per-case quality
    print("  Case predictions vs KP:")
    worst = []
    for (y_obs, feats, r), y_hat in zip(data, Y_pred):
        p_obs = 1.0 / (1.0 + math.exp(-y_obs)) * 1000
        p_pred = 1.0 / (1.0 + math.exp(-y_hat)) * 1000
        delta = p_pred - p_obs
        worst.append((abs(delta), p_obs, p_pred, delta, r))
    worst.sort(key=lambda t: t[0], reverse=True)
    print("  Top 5 mismatches (per-1000):")
    for _, p_obs, p_pred, delta, r in worst[:5]:
        print(f"    GA={r['GA_Weeks']}w{r['GA_Days']}d T={r['Temp_F']}F ROM={r['ROM_Hours']}h "
              f"GBS={r['GBS_Status']} abx={r['Antibiotics']}: "
              f"KP={p_obs:.3f}, fit={p_pred:.3f}, Δ={delta:+.3f}")

    return dict(zip(FEATURE_NAMES, beta.tolist()))


def main():
    with open(INPUT_CSV) as f:
        rows = list(csv.DictReader(f))
    print(f"Loaded {len(rows)} rows from {INPUT_CSV}")

    out = {}
    for v in ("2017", "2024"):
        coefs = fit_model(rows, v)
        if coefs is not None:
            out[v] = coefs

    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
