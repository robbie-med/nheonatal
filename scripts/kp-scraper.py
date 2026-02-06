#!/usr/bin/env python3
"""
Kaiser Permanente EOS Calculator Data Collection Script (FIXED)

AUTHORIZATION: Kaiser Permanente Legal Dept, Feb 5, 2026
- Max 5 requests/minute (we use 1 per 15 seconds = 4/min)
- Valid Feb 5-12, 2026
- Max 10 complete runs

Usage:
    python kp-scraper.py [--test] [--resume] [--delay 15]
"""

import requests
from bs4 import BeautifulSoup
import csv
import time
import re
import argparse
import urllib3
from datetime import datetime
from typing import Optional, Tuple

BASE_URL = "https://neonatalsepsiscalculator.kaiserpermanente.org/InfectionProbabilityCalculator.aspx"
OUTPUT_FILE = "kp-eos-data.csv"

# Incidence values from the dropdown (these are log-odds adjustments)
INCIDENCE_VALUES = {
    "0.1": "38.952265",
    "0.2": "39.646367",
    "0.3": "40.05280",   # KPNC incidence
    "0.4": "40.34150",
    "0.5": "40.56560",   # CDC national incidence
    "0.6": "40.74890",
    "0.7": "40.903919",
    "0.8": "41.0384",
    "0.9": "41.1571",
    "1.0": "41.263432",
    "2.0": "41.965852",
    "4.0": "42.676976",
}

# Test vectors - systematic permutation of key variables
# Format: (Model, GA_weeks, GA_days, Temp_F, ROM_hours, GBS, Antibiotics, Incidence)
# Model: "2017" or "2024"
# GBS: "Negative", "Positive", "Unknown"
# Antibiotics: "broad4", "broad2", "gbs2", "none"
# Incidence: "0.5" (CDC national - we'll use this as baseline)

TEST_CASES = [
    # === BASE CASES (isolate intercept) ===
    ("2017", 40, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2024", 40, 0, 98.0, 0, "Negative", "none", "0.5"),

    # === TEMPERATURE SENSITIVITY (2017 model) ===
    ("2017", 40, 0, 98.5, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 99.0, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 99.5, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 100.0, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 100.5, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 101.0, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 101.5, 0, "Negative", "none", "0.5"),
    ("2017", 40, 0, 102.0, 0, "Negative", "none", "0.5"),

    # === TEMPERATURE SENSITIVITY (2024 model) ===
    ("2024", 40, 0, 99.0, 0, "Negative", "none", "0.5"),
    ("2024", 40, 0, 100.0, 0, "Negative", "none", "0.5"),
    ("2024", 40, 0, 101.0, 0, "Negative", "none", "0.5"),
    ("2024", 40, 0, 102.0, 0, "Negative", "none", "0.5"),

    # === ROM SENSITIVITY ===
    ("2017", 40, 0, 98.0, 6, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 12, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 18, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 24, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 36, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 48, "Negative", "none", "0.5"),
    ("2017", 40, 0, 98.0, 72, "Negative", "none", "0.5"),

    # === GBS STATUS (KEY DIFFERENCE BETWEEN MODELS) ===
    ("2017", 40, 0, 98.0, 0, "Positive", "none", "0.5"),
    ("2017", 40, 0, 98.0, 0, "Unknown", "none", "0.5"),
    ("2024", 40, 0, 98.0, 0, "Positive", "none", "0.5"),
    ("2024", 40, 0, 98.0, 0, "Unknown", "none", "0.5"),

    # === GESTATIONAL AGE ===
    ("2017", 34, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 35, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 36, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 37, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 38, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 39, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 41, 0, 98.0, 0, "Negative", "none", "0.5"),
    ("2017", 42, 0, 98.0, 0, "Negative", "none", "0.5"),

    # === GA with days (check granularity) ===
    ("2017", 39, 3, 98.0, 0, "Negative", "none", "0.5"),
    ("2024", 39, 3, 98.0, 0, "Negative", "none", "0.5"),

    # === ANTIBIOTICS ===
    ("2017", 40, 0, 98.0, 0, "Positive", "broad4", "0.5"),
    ("2017", 40, 0, 98.0, 0, "Positive", "broad2", "0.5"),
    ("2017", 40, 0, 98.0, 0, "Positive", "gbs2", "0.5"),
    ("2024", 40, 0, 98.0, 0, "Positive", "broad4", "0.5"),
    ("2024", 40, 0, 98.0, 0, "Positive", "gbs2", "0.5"),

    # === COMBINED HIGH RISK ===
    ("2017", 35, 0, 101.0, 24, "Positive", "none", "0.5"),
    ("2024", 35, 0, 101.0, 24, "Positive", "none", "0.5"),

    # === GBS UNKNOWN HIGH RISK (key 2017 vs 2024 difference) ===
    ("2017", 38, 0, 100.0, 18, "Unknown", "none", "0.5"),
    ("2024", 38, 0, 100.0, 18, "Unknown", "none", "0.5"),

    # === INCIDENCE SENSITIVITY (to verify intercept adjustment) ===
    ("2017", 40, 0, 98.0, 0, "Negative", "none", "0.3"),
    ("2017", 40, 0, 98.0, 0, "Negative", "none", "1.0"),
]


class KPScraper:
    def __init__(self, delay_seconds: int = 15, verify_ssl: bool = True):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        })
        self.delay_seconds = delay_seconds
        self.verify_ssl = verify_ssl
        self.viewstate = None
        self.viewstate_generator = None
        self.event_validation = None

    def get_initial_page(self) -> bool:
        """Fetch initial page to get VIEWSTATE and other hidden fields."""
        try:
            response = self.session.get(BASE_URL, verify=self.verify_ssl)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            vs = soup.find('input', {'name': '__VIEWSTATE'})
            vsg = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
            ev = soup.find('input', {'name': '__EVENTVALIDATION'})

            self.viewstate = vs['value'] if vs else None
            self.viewstate_generator = vsg['value'] if vsg else None
            self.event_validation = ev['value'] if ev else None

            print(f"Got VIEWSTATE (length: {len(self.viewstate) if self.viewstate else 0})")
            return True

        except Exception as e:
            print(f"ERROR fetching initial page: {e}")
            return False

    def submit_calculation(self, case: tuple) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], str]:
        """Submit calculation and return (risk_at_birth, well_appearing, equivocal, clinical_illness, raw_html)."""
        model, ga_w, ga_d, temp_f, rom, gbs, abx, incidence = case

        # Map GBS to hidden radio button value
        gbs_map = {
            "Negative": ("rbGBSHidden1", "rbGBSHidden1"),
            "Positive": ("rbGBSHidden2", "rbGBSHidden2"),
            "Unknown": ("rbGBSHidden3", "rbGBSHidden3"),
        }

        # Map Antibiotics to hidden radio button value
        abx_map = {
            "broad4": ("rbIntraHidden1", "rbIntraHidden1"),  # Broad spectrum > 4 hrs
            "broad2": ("rbIntraHidden2", "rbIntraHidden2"),  # Broad spectrum 2-3.9 hrs
            "gbs2": ("rbIntraHidden3", "rbIntraHidden3"),    # GBS specific > 2 hrs
            "none": ("rbIntraHidden4", "rbIntraHidden4"),    # No antibiotics or < 2 hrs
        }

        # Map model to hidden radio button
        model_map = {
            "2017": ("rbUSAHidden1", "rbUSAHidden1"),
            "2024": ("rbUSAHidden2", "rbUSAHidden2"),
        }

        # Build form data with CORRECT field names
        prefix = "ctl00$MainContent$InfectionProbabilityCalculations$"

        form_data = {
            '__EVENTTARGET': '',
            '__EVENTARGUMENT': '',
            '__LASTFOCUS': '',
            '__VIEWSTATE': self.viewstate,
            '__VIEWSTATEGENERATOR': self.viewstate_generator,
            '__EVENTVALIDATION': self.event_validation,

            # Calculator Version (2017 or 2024)
            f'{prefix}rbUU': model_map[model][0],

            # Incidence dropdown
            f'{prefix}ddlIncidence': INCIDENCE_VALUES[incidence],

            # Gestational Age
            f'{prefix}txtGestational': str(ga_w),
            f'{prefix}txtDays': str(ga_d),

            # Temperature
            f'{prefix}txtTemperature': f'{temp_f:.1f}',
            f'{prefix}ddlFarCal': 'F',

            # ROM
            f'{prefix}txtROM': str(rom),

            # GBS Status
            f'{prefix}rbGG': gbs_map[gbs][0],

            # Antibiotics
            f'{prefix}rbMM': abx_map[abx][0],

            # Submit button
            f'{prefix}btnCalc': 'Calculate »',
        }

        try:
            response = self.session.post(BASE_URL, data=form_data, verify=self.verify_ssl)
            response.raise_for_status()

            # Update viewstate for next request
            soup = BeautifulSoup(response.text, 'html.parser')

            vs = soup.find('input', {'name': '__VIEWSTATE'})
            ev = soup.find('input', {'name': '__EVENTVALIDATION'})
            if vs:
                self.viewstate = vs['value']
            if ev:
                self.event_validation = ev['value']

            # Parse results
            return self._parse_response(response.text, soup)

        except Exception as e:
            print(f"  ERROR: {e}")
            return None, None, None, None, str(e)

    def _parse_response(self, html: str, soup: BeautifulSoup) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], str]:
        """Parse the response HTML to extract risk values."""

        risk_birth = None
        well_appearing = None
        equivocal = None
        clinical_illness = None

        # Find the specific label elements by their IDs
        # EOS Risk at Birth
        lbl_eos = soup.find(id='MainContent_InfectionProbabilityCalculations_lblEOS')
        if lbl_eos and lbl_eos.get_text(strip=True):
            try:
                risk_birth = float(lbl_eos.get_text(strip=True))
            except ValueError:
                pass

        # Well Appearing
        lbl_well = soup.find(id='MainContent_InfectionProbabilityCalculations_lblWellAppearing')
        if lbl_well and lbl_well.get_text(strip=True):
            try:
                well_appearing = float(lbl_well.get_text(strip=True))
            except ValueError:
                pass

        # Equivocal
        lbl_equi = soup.find(id='MainContent_InfectionProbabilityCalculations_lblEquivocal')
        if lbl_equi and lbl_equi.get_text(strip=True):
            try:
                equivocal = float(lbl_equi.get_text(strip=True))
            except ValueError:
                pass

        # Clinical Illness
        lbl_clin = soup.find(id='MainContent_InfectionProbabilityCalculations_lblClinical')
        if lbl_clin and lbl_clin.get_text(strip=True):
            try:
                clinical_illness = float(lbl_clin.get_text(strip=True))
            except ValueError:
                pass

        # Check for validation errors
        errors = soup.find_all(class_='ErrorMessage')
        error_texts = []
        for err in errors:
            if err.get('style') != 'display:none;' and err.get_text(strip=True):
                error_texts.append(err.get_text(strip=True))

        debug_info = "; ".join(error_texts) if error_texts else ""

        return risk_birth, well_appearing, equivocal, clinical_illness, debug_info


def main():
    parser = argparse.ArgumentParser(description='KP EOS Calculator Scraper')
    parser.add_argument('--test', action='store_true', help='Run only 5 test cases')
    parser.add_argument('--resume', action='store_true', help='Resume from last position')
    parser.add_argument('--delay', type=int, default=15, help='Delay between requests (seconds)')
    parser.add_argument('--output', type=str, default=OUTPUT_FILE, help='Output CSV file')
    parser.add_argument('--no-verify-ssl', action='store_true', help='Disable SSL certificate verification (for Windows)')
    args = parser.parse_args()

    # Disable SSL warnings if verification is disabled
    if args.no_verify_ssl:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        print("WARNING: SSL certificate verification disabled")

    print("=" * 60)
    print("Kaiser Permanente EOS Calculator Scraper (FIXED)")
    print("Authorization: KP Legal Dept, Feb 5, 2026")
    print(f"Rate Limit: 1 request per {args.delay} seconds")
    print("=" * 60)
    print()

    # Determine cases to run
    cases = TEST_CASES[:5] if args.test else TEST_CASES

    # Check for resume
    start_index = 0
    if args.resume:
        try:
            with open(args.output, 'r') as f:
                reader = csv.reader(f)
                start_index = sum(1 for _ in reader) - 1  # Subtract header
                print(f"RESUME MODE: Starting from case {start_index}")
        except FileNotFoundError:
            pass

    # Initialize CSV if new
    if start_index == 0:
        with open(args.output, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'CaseNum', 'Model', 'GA_Weeks', 'GA_Days', 'Temp_F', 'ROM_Hours',
                'GBS_Status', 'Antibiotics', 'Incidence',
                'KP_RiskAtBirth', 'KP_WellAppearing', 'KP_Equivocal', 'KP_ClinicalIllness',
                'Debug', 'Timestamp'
            ])

    print(f"Total cases: {len(cases)}")
    print(f"Starting from: {start_index}")
    print()

    # Initialize scraper
    scraper = KPScraper(delay_seconds=args.delay, verify_ssl=not args.no_verify_ssl)

    print("Fetching initial page state...")
    if not scraper.get_initial_page():
        print("Failed to initialize. Exiting.")
        return

    # Process each test case
    for i in range(start_index, len(cases)):
        case = cases[i]
        case_num = i + 1
        model, ga_w, ga_d, temp_f, rom, gbs, abx, incidence = case

        print(f"[{case_num}/{len(cases)}] Model={model} GA={ga_w}w{ga_d}d Temp={temp_f}F ROM={rom}h GBS={gbs} Abx={abx}")

        risk_birth, well_appearing, equivocal, clinical_illness, debug = scraper.submit_calculation(case)

        # Log result
        with open(args.output, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                case_num, model, ga_w, ga_d, temp_f, rom, gbs, abx, incidence,
                risk_birth if risk_birth is not None else 'ERROR',
                well_appearing if well_appearing is not None else 'ERROR',
                equivocal if equivocal is not None else 'ERROR',
                clinical_illness if clinical_illness is not None else 'ERROR',
                debug,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ])

        # Save debug HTML for first few cases
        if i < 3:
            with open(f'debug_response_{case_num}.html', 'w', encoding='utf-8') as f:
                f.write(debug if len(debug) > 1000 else f"Risk: {risk_birth}, Well: {well_appearing}, Equi: {equivocal}, Clin: {clinical_illness}")

        if risk_birth is not None:
            print(f"  -> Birth: {risk_birth} | Well: {well_appearing} | Equi: {equivocal} | Clin: {clinical_illness}")
        else:
            print(f"  -> ERROR: {debug[:100] if debug else 'No results found'}")

        # Rate limiting
        if i < len(cases) - 1:
            print(f"  Waiting {args.delay} seconds...")
            time.sleep(args.delay)

    print()
    print("=" * 60)
    print(f"COMPLETE! Data saved to: {args.output}")
    print("=" * 60)


if __name__ == '__main__':
    main()
