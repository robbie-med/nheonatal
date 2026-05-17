#!/usr/bin/env python3
"""Rescrape only the 2017 cases that errored. Calls select_model('2017') first.
Appends to kp-eos-data.csv (skipping cases that already have non-ERROR values)."""

import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import importlib.util

# Load the scraper module
spec = importlib.util.spec_from_file_location("kp_scraper", Path(__file__).parent / "kp-scraper.py")
kp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kp)

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CSV_PATH = Path(__file__).parent.parent / "kp-eos-data.csv"

# Read existing CSV to find ERROR rows
rows = list(csv.DictReader(open(CSV_PATH)))
to_redo = [r for r in rows if r["Model"] == "2017" and r["KP_RiskAtBirth"] == "ERROR"]
print(f"Found {len(to_redo)} 2017 ERROR rows to rescrape")

scraper = kp.KPScraper(delay_seconds=15, verify_ssl=False)
print("Init session...")
scraper.get_initial_page()
print("Switching to 2017 model...")
scraper.select_model("2017")
time.sleep(2)

results = {}
for i, r in enumerate(to_redo):
    case = (
        r["Model"], int(r["GA_Weeks"]), int(r["GA_Days"]),
        float(r["Temp_F"]), int(r["ROM_Hours"]),
        r["GBS_Status"], r["Antibiotics"], r["Incidence"]
    )
    print(f"[{i+1}/{len(to_redo)}] {case}")
    risk, well, equi, clin, debug = scraper.submit_calculation(case)
    print(f"  -> Birth={risk} Well={well} Equi={equi} Clin={clin} dbg={debug[:80]}")
    if risk is not None:
        results[r["CaseNum"]] = (risk, well, equi, clin)
    if i < len(to_redo) - 1:
        time.sleep(15)

# Update CSV in-place
print(f"\nUpdating {len(results)} rows in CSV...")
fieldnames = list(rows[0].keys())
for r in rows:
    if r["CaseNum"] in results:
        risk, well, equi, clin = results[r["CaseNum"]]
        r["KP_RiskAtBirth"] = str(risk)
        r["KP_WellAppearing"] = str(well)
        r["KP_Equivocal"] = str(equi)
        r["KP_ClinicalIllness"] = str(clin)

with open(CSV_PATH, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print("Done.")
