#!/usr/bin/env python3
"""Add 2017 abx cases to kp-eos-data.csv.

The 2017 abx coefficients in the original fit were 0 (no abx data was scraped
for 2017). This script scrapes the three KP abx buckets (broad4, broad2, gbs2)
at the 2017 baseline configuration so the fit produces real coefficients.
"""

import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import importlib.util

spec = importlib.util.spec_from_file_location("kp_scraper", Path(__file__).parent / "kp-scraper.py")
kp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kp)

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CSV_PATH = Path(__file__).parent.parent / "kp-eos-data.csv"

# Mirror cases 29, 30, 31 (which are the 2024 abx baselines) into the 2017 model.
# Also add a 2017 case with abx + GBS+ + temp elevation to disambiguate
# the abx coefficient from the GBS coefficient under combined risk factors.
NEW_CASES = [
    # (Model, GA_weeks, GA_days, Temp_F, ROM_hours, GBS, Antibiotics, Incidence)
    ("2017", 40, 0, 98.0, 0, "Positive", "broad4", "0.5"),
    ("2017", 40, 0, 98.0, 0, "Positive", "broad2", "0.5"),
    ("2017", 40, 0, 98.0, 0, "Positive", "gbs2",   "0.5"),
    # Combined-risk anchors so the fit doesn't collinearly mix abx with other terms
    ("2017", 38, 0, 100.0, 12, "Positive", "broad4", "0.5"),
    ("2017", 38, 0, 100.0, 12, "Positive", "gbs2",   "0.5"),
]

rows = list(csv.DictReader(open(CSV_PATH)))
fieldnames = list(rows[0].keys())
existing_max_case = max(int(r["CaseNum"]) for r in rows)
print(f"Existing rows: {len(rows)} (max CaseNum {existing_max_case})")

scraper = kp.KPScraper(delay_seconds=15, verify_ssl=False)
print("Init session...")
scraper.get_initial_page()
print("Switching to 2017 model...")
scraper.select_model("2017")
time.sleep(2)

new_rows = []
for i, case in enumerate(NEW_CASES):
    case_num = existing_max_case + 1 + i
    print(f"[{i+1}/{len(NEW_CASES)}] Case {case_num}: {case}")
    risk, well, equi, clin, debug = scraper.submit_calculation(case)
    print(f"  -> Birth={risk} Well={well} Equi={equi} Clin={clin}")

    new_rows.append({
        "CaseNum": str(case_num),
        "Model": case[0],
        "GA_Weeks": str(case[1]),
        "GA_Days": str(case[2]),
        "Temp_F": str(case[3]),
        "ROM_Hours": str(case[4]),
        "GBS_Status": case[5],
        "Antibiotics": case[6],
        "Incidence": case[7],
        "KP_RiskAtBirth": str(risk) if risk is not None else "ERROR",
        "KP_WellAppearing": str(well) if well is not None else "ERROR",
        "KP_Equivocal": str(equi) if equi is not None else "ERROR",
        "KP_ClinicalIllness": str(clin) if clin is not None else "ERROR",
        "Debug": "",
        "Timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    })
    if i < len(NEW_CASES) - 1:
        time.sleep(15)

# Append to CSV
print(f"\nAppending {len(new_rows)} rows to {CSV_PATH}...")
with open(CSV_PATH, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows + new_rows)

print("Done.")
