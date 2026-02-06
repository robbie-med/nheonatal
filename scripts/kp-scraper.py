#!/usr/bin/env python3
"""
Kaiser Permanente EOS Calculator Data Collection Script

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
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

BASE_URL = "https://neonatalsepsiscalculator.kaiserpermanente.org/InfectionProbabilityCalculator.aspx"
OUTPUT_FILE = "kp-eos-data.csv"

# Test vectors - systematic permutation of key variables
TEST_CASES = [
    # Format: (Model, GA_weeks, GA_days, Temp_F, ROM_hours, GBS, Abx_type, Abx_duration, Clinical)

    # === BASE CASES (isolate intercept) ===
    ("2017", 40, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2024", 40, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),

    # === TEMPERATURE SENSITIVITY (2017 model) ===
    ("2017", 40, 0, 98.5, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 99.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 99.5, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 100.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 100.5, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 101.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 101.5, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 102.0, 0, "Negative", "None", "", "Well Appearing"),

    # === TEMPERATURE SENSITIVITY (2024 model) ===
    ("2024", 40, 0, 99.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2024", 40, 0, 100.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2024", 40, 0, 101.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2024", 40, 0, 102.0, 0, "Negative", "None", "", "Well Appearing"),

    # === ROM SENSITIVITY ===
    ("2017", 40, 0, 98.0, 6, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 12, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 18, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 24, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 36, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 48, "Negative", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 72, "Negative", "None", "", "Well Appearing"),

    # === GBS STATUS (KEY DIFFERENCE BETWEEN MODELS) ===
    ("2017", 40, 0, 98.0, 0, "Positive", "None", "", "Well Appearing"),
    ("2017", 40, 0, 98.0, 0, "Unknown", "None", "", "Well Appearing"),
    ("2024", 40, 0, 98.0, 0, "Positive", "None", "", "Well Appearing"),
    ("2024", 40, 0, 98.0, 0, "Unknown", "None", "", "Well Appearing"),

    # === GESTATIONAL AGE ===
    ("2017", 34, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 35, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 36, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 37, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 38, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 39, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 41, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2017", 42, 0, 98.0, 0, "Negative", "None", "", "Well Appearing"),

    # === GA with days (check granularity) ===
    ("2017", 39, 3, 98.0, 0, "Negative", "None", "", "Well Appearing"),
    ("2024", 39, 3, 98.0, 0, "Negative", "None", "", "Well Appearing"),

    # === CLINICAL EXAM (Likelihood Ratios) ===
    ("2017", 40, 0, 100.0, 0, "Negative", "None", "", "Equivocal"),
    ("2017", 40, 0, 100.0, 0, "Negative", "None", "", "Clinical Illness"),
    ("2024", 40, 0, 100.0, 0, "Negative", "None", "", "Equivocal"),
    ("2024", 40, 0, 100.0, 0, "Negative", "None", "", "Clinical Illness"),

    # === ANTIBIOTICS ===
    ("2017", 40, 0, 98.0, 0, "Positive", "GBS Specific", "Broad Spectrum >= 4 hrs prior to delivery", "Well Appearing"),
    ("2017", 40, 0, 98.0, 0, "Positive", "GBS Specific", "GBS Specific >= 2 hrs prior to delivery", "Well Appearing"),
    ("2017", 40, 0, 98.0, 0, "Positive", "Broad Spectrum", "Broad Spectrum >= 4 hrs prior to delivery", "Well Appearing"),

    # === COMBINED HIGH RISK ===
    ("2017", 35, 0, 101.0, 24, "Positive", "None", "", "Well Appearing"),
    ("2017", 35, 0, 101.0, 24, "Positive", "None", "", "Equivocal"),
    ("2017", 35, 0, 101.0, 24, "Positive", "None", "", "Clinical Illness"),
    ("2024", 35, 0, 101.0, 24, "Positive", "None", "", "Well Appearing"),
    ("2024", 35, 0, 101.0, 24, "Positive", "None", "", "Clinical Illness"),

    # === GBS UNKNOWN HIGH RISK (key 2017 vs 2024 difference) ===
    ("2017", 38, 0, 100.0, 18, "Unknown", "None", "", "Well Appearing"),
    ("2024", 38, 0, 100.0, 18, "Unknown", "None", "", "Well Appearing"),
]


class KPScraper:
    def __init__(self, delay_seconds: int = 15):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        })
        self.delay_seconds = delay_seconds
        self.viewstate = None
        self.viewstate_generator = None
        self.event_validation = None

    def get_initial_page(self) -> bool:
        """Fetch initial page to get VIEWSTATE and other hidden fields."""
        try:
            response = self.session.get(BASE_URL)
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

    def submit_calculation(self, case: tuple) -> Tuple[Optional[float], Optional[float], str]:
        """Submit calculation and return (risk_at_birth, risk_posterior, recommendation)."""
        model, ga_w, ga_d, temp_f, rom, gbs, abx_type, abx_dur, clinical = case

        form_data = {
            '__EVENTTARGET': '',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': self.viewstate,
            '__VIEWSTATEGENERATOR': self.viewstate_generator,
            '__EVENTVALIDATION': self.event_validation,
            'ctl00$phContent$ddlSepsisModel': model,
            'ctl00$phContent$ddlGA_Weeks': str(ga_w),
            'ctl00$phContent$ddlGA_Days': str(ga_d),
            'ctl00$phContent$txtHighestMaternalAntepartumTemperature': f'{temp_f:.1f}',
            'ctl00$phContent$txtRuptureOfMembranesHrs': str(rom),
            'ctl00$phContent$ddlGBS': gbs,
            'ctl00$phContent$ddlAntibiotics': abx_type,
            'ctl00$phContent$ddlClinicalPresentation': clinical,
            'ctl00$phContent$btnCalculate': 'Calculate',
        }

        if abx_type != 'None' and abx_dur:
            form_data['ctl00$phContent$ddlAntibioticDuration'] = abx_dur

        try:
            response = self.session.post(BASE_URL, data=form_data)
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
            return self._parse_response(response.text)

        except Exception as e:
            print(f"  ERROR: {e}")
            return None, None, str(e)

    def _parse_response(self, html: str) -> Tuple[Optional[float], Optional[float], str]:
        """Parse the response HTML to extract risk values."""
        soup = BeautifulSoup(html, 'html.parser')

        risk_birth = None
        risk_posterior = None
        recommendation = ""

        # Try to find the risk values in the page
        # Look for specific label IDs first
        prior_label = soup.find(id=re.compile(r'lblPriorProbability', re.I))
        posterior_label = soup.find(id=re.compile(r'lblPosteriorProbability', re.I))
        rec_label = soup.find(id=re.compile(r'lblRecommendation', re.I))

        if prior_label:
            try:
                risk_birth = float(prior_label.get_text(strip=True))
            except ValueError:
                pass

        if posterior_label:
            try:
                risk_posterior = float(posterior_label.get_text(strip=True))
            except ValueError:
                pass

        if rec_label:
            recommendation = rec_label.get_text(strip=True)

        # Fallback: search in raw text
        if risk_birth is None:
            match = re.search(r'Risk at Birth[^\d]*(\d+\.?\d*)\s*per\s*1000', html, re.I)
            if match:
                risk_birth = float(match.group(1))

        if risk_posterior is None:
            match = re.search(r'Risk after[^\d]*(\d+\.?\d*)\s*per\s*1000', html, re.I)
            if match:
                risk_posterior = float(match.group(1))

        return risk_birth, risk_posterior, recommendation


def main():
    parser = argparse.ArgumentParser(description='KP EOS Calculator Scraper')
    parser.add_argument('--test', action='store_true', help='Run only 3 test cases')
    parser.add_argument('--resume', action='store_true', help='Resume from last position')
    parser.add_argument('--delay', type=int, default=15, help='Delay between requests (seconds)')
    parser.add_argument('--output', type=str, default=OUTPUT_FILE, help='Output CSV file')
    args = parser.parse_args()

    print("=" * 50)
    print("Kaiser Permanente EOS Calculator Scraper")
    print("Authorization: KP Legal Dept, Feb 5, 2026")
    print(f"Rate Limit: 1 request per {args.delay} seconds")
    print("=" * 50)
    print()

    # Determine cases to run
    cases = TEST_CASES[:3] if args.test else TEST_CASES

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
                'GBS_Status', 'Abx_Type', 'Abx_Duration', 'Clinical_Exam',
                'KP_RiskAtBirth', 'KP_RiskPosterior', 'KP_Recommendation', 'Timestamp'
            ])

    print(f"Total cases: {len(cases)}")
    print(f"Starting from: {start_index}")
    print()

    # Initialize scraper
    scraper = KPScraper(delay_seconds=args.delay)

    print("Fetching initial page state...")
    if not scraper.get_initial_page():
        print("Failed to initialize. Exiting.")
        return

    # Process each test case
    for i in range(start_index, len(cases)):
        case = cases[i]
        case_num = i + 1
        model, ga_w, ga_d, temp_f, rom, gbs, abx_type, abx_dur, clinical = case

        print(f"[{case_num}/{len(cases)}] Model={model} GA={ga_w}w{ga_d}d Temp={temp_f}F ROM={rom}h GBS={gbs} Clinical={clinical}")

        risk_birth, risk_posterior, recommendation = scraper.submit_calculation(case)

        # Log result
        with open(args.output, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                case_num, model, ga_w, ga_d, temp_f, rom, gbs, abx_type, abx_dur, clinical,
                risk_birth if risk_birth is not None else 'ERROR',
                risk_posterior if risk_posterior is not None else 'ERROR',
                recommendation,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ])

        if risk_birth is not None:
            print(f"  -> Birth: {risk_birth} | Posterior: {risk_posterior}")
        else:
            print(f"  -> ERROR parsing response")

        # Rate limiting
        if i < len(cases) - 1:
            print(f"  Waiting {args.delay} seconds...")
            time.sleep(args.delay)

    print()
    print("=" * 50)
    print(f"COMPLETE! Data saved to: {args.output}")
    print("=" * 50)


if __name__ == '__main__':
    main()
