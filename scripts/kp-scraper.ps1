<#
.SYNOPSIS
    Kaiser Permanente EOS Calculator Data Collection Script

.DESCRIPTION
    Collects input/output pairs from the KP Neonatal Sepsis Calculator
    for reverse-engineering coefficient calibration.

    AUTHORIZATION: Kaiser Permanente Legal Dept, Feb 5, 2026
    - Max 5 requests/minute (we use 1 per 15 seconds = 4/min)
    - Valid Feb 5-12, 2026
    - Max 10 complete runs

.NOTES
    Author: RobbieMed.org Technical Operations
    Date: February 2026
#>

param(
    [string]$OutputFile = "kp-eos-data.csv",
    [int]$DelaySeconds = 15,  # 4 requests/min, well under 5/min limit
    [switch]$TestMode,        # Only run 3 test cases
    [switch]$Resume           # Resume from last position in output file
)

$BaseUrl = "https://neonatalsepsiscalculator.kaiserpermanente.org/InfectionProbabilityCalculator.aspx"

# ============================================================================
# TEST VECTORS - Systematic permutation of key variables
# ============================================================================

$TestCases = @(
    # Format: Model, GA_weeks, GA_days, Temp_F, ROM_hours, GBS, Abx_type, Abx_duration, Clinical

    # === BASE CASES (isolate intercept) ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === TEMPERATURE SENSITIVITY (2017 model) ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.5; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=99.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=99.5; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=100.5; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=101.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=101.5; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=102.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === TEMPERATURE SENSITIVITY (2024 model) ===
    @{ Model="2024"; GAw=40; GAd=0; TempF=99.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=101.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=102.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === ROM SENSITIVITY ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=6; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=12; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=18; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=24; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=36; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=48; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=72; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === GBS STATUS (KEY DIFFERENCE BETWEEN MODELS) ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Unknown"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Unknown"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === GESTATIONAL AGE ===
    @{ Model="2017"; GAw=34; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=35; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=36; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=37; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=38; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=39; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=41; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=42; GAd=0; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === GA with days (check granularity) ===
    @{ Model="2017"; GAw=39; GAd=3; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=39; GAd=3; TempF=98.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }

    # === CLINICAL EXAM (Likelihood Ratios) ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Equivocal" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Clinical Illness" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Equivocal" }
    @{ Model="2024"; GAw=40; GAd=0; TempF=100.0; ROM=0; GBS="Negative"; AbxType="None"; AbxDur=""; Clinical="Clinical Illness" }

    # === ANTIBIOTICS ===
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Positive"; AbxType="GBS Specific"; AbxDur="Broad Spectrum >= 4 hrs prior to delivery"; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Positive"; AbxType="GBS Specific"; AbxDur="GBS Specific >= 2 hrs prior to delivery"; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=40; GAd=0; TempF=98.0; ROM=0; GBS="Positive"; AbxType="Broad Spectrum"; AbxDur="Broad Spectrum >= 4 hrs prior to delivery"; Clinical="Well Appearing" }

    # === COMBINED HIGH RISK ===
    @{ Model="2017"; GAw=35; GAd=0; TempF=101.0; ROM=24; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2017"; GAw=35; GAd=0; TempF=101.0; ROM=24; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Equivocal" }
    @{ Model="2017"; GAw=35; GAd=0; TempF=101.0; ROM=24; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Clinical Illness" }
    @{ Model="2024"; GAw=35; GAd=0; TempF=101.0; ROM=24; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=35; GAd=0; TempF=101.0; ROM=24; GBS="Positive"; AbxType="None"; AbxDur=""; Clinical="Clinical Illness" }

    # === GBS UNKNOWN HIGH RISK (key 2017 vs 2024 difference) ===
    @{ Model="2017"; GAw=38; GAd=0; TempF=100.0; ROM=18; GBS="Unknown"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
    @{ Model="2024"; GAw=38; GAd=0; TempF=100.0; ROM=18; GBS="Unknown"; AbxType="None"; AbxDur=""; Clinical="Well Appearing" }
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Get-InitialPageState {
    <#
    .SYNOPSIS
        Fetches the initial page to get VIEWSTATE and other hidden fields
    #>
    param([Microsoft.PowerShell.Commands.WebRequestSession]$Session)

    $response = Invoke-WebRequest -Uri $BaseUrl -SessionVariable Session -UseBasicParsing

    $viewState = ($response.InputFields | Where-Object { $_.name -eq "__VIEWSTATE" }).value
    $viewStateGen = ($response.InputFields | Where-Object { $_.name -eq "__VIEWSTATEGENERATOR" }).value
    $eventValidation = ($response.InputFields | Where-Object { $_.name -eq "__EVENTVALIDATION" }).value

    return @{
        Session = $Session
        ViewState = $viewState
        ViewStateGenerator = $viewStateGen
        EventValidation = $eventValidation
        Response = $response
    }
}

function Submit-CalculatorForm {
    <#
    .SYNOPSIS
        Submits the calculator form with specified inputs
    #>
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$ViewState,
        [string]$ViewStateGenerator,
        [string]$EventValidation,
        [hashtable]$Inputs
    )

    # Build form data matching the ASP.NET WebForms structure
    $formData = @{
        "__EVENTTARGET" = ""
        "__EVENTARGUMENT" = ""
        "__VIEWSTATE" = $ViewState
        "__VIEWSTATEGENERATOR" = $ViewStateGenerator
        "__EVENTVALIDATION" = $EventValidation
        "ctl00`$phContent`$ddlSepsisModel" = $Inputs.Model
        "ctl00`$phContent`$ddlGA_Weeks" = $Inputs.GAw.ToString()
        "ctl00`$phContent`$ddlGA_Days" = $Inputs.GAd.ToString()
        "ctl00`$phContent`$txtHighestMaternalAntepartumTemperature" = $Inputs.TempF.ToString("F1")
        "ctl00`$phContent`$txtRuptureOfMembranesHrs" = $Inputs.ROM.ToString()
        "ctl00`$phContent`$ddlGBS" = $Inputs.GBS
        "ctl00`$phContent`$ddlAntibiotics" = $Inputs.AbxType
        "ctl00`$phContent`$ddlClinicalPresentation" = $Inputs.Clinical
        "ctl00`$phContent`$btnCalculate" = "Calculate"
    }

    # Add antibiotic duration if antibiotics given
    if ($Inputs.AbxType -ne "None" -and $Inputs.AbxDur) {
        $formData["ctl00`$phContent`$ddlAntibioticDuration"] = $Inputs.AbxDur
    }

    $response = Invoke-WebRequest -Uri $BaseUrl -Method POST -Body $formData -WebSession $Session -UseBasicParsing

    return $response
}

function Parse-CalculatorResponse {
    <#
    .SYNOPSIS
        Parses the response HTML to extract risk values
    #>
    param([Microsoft.PowerShell.Commands.WebResponseObject]$Response)

    $html = $Response.Content

    # Extract "Risk at Birth" value
    $riskAtBirth = $null
    if ($html -match 'Risk at Birth[^0-9]*([0-9]+\.?[0-9]*)\s*per\s*1000') {
        $riskAtBirth = [double]$Matches[1]
    }
    elseif ($html -match 'lblPriorProbability[^>]*>([0-9]+\.?[0-9]*)') {
        $riskAtBirth = [double]$Matches[1]
    }

    # Extract "Risk after Clinical Exam" value
    $riskPosterior = $null
    if ($html -match 'Risk after[^0-9]*([0-9]+\.?[0-9]*)\s*per\s*1000') {
        $riskPosterior = [double]$Matches[1]
    }
    elseif ($html -match 'lblPosteriorProbability[^>]*>([0-9]+\.?[0-9]*)') {
        $riskPosterior = [double]$Matches[1]
    }

    # Extract recommendation text
    $recommendation = ""
    if ($html -match 'lblRecommendation[^>]*>([^<]+)') {
        $recommendation = $Matches[1].Trim()
    }

    return @{
        RiskAtBirth = $riskAtBirth
        RiskPosterior = $riskPosterior
        Recommendation = $recommendation
        RawHtml = $html
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Kaiser Permanente EOS Calculator Scraper" -ForegroundColor Cyan
Write-Host "Authorization: KP Legal Dept, Feb 5, 2026" -ForegroundColor Yellow
Write-Host "Rate Limit: 1 request per $DelaySeconds seconds" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Determine which test cases to run
$casesToRun = $TestCases
if ($TestMode) {
    $casesToRun = $TestCases[0..2]
    Write-Host "TEST MODE: Running only 3 test cases" -ForegroundColor Magenta
}

# Check for resume
$startIndex = 0
if ($Resume -and (Test-Path $OutputFile)) {
    $existingRows = Import-Csv $OutputFile
    $startIndex = $existingRows.Count
    Write-Host "RESUME MODE: Starting from case $startIndex" -ForegroundColor Green
}

# Initialize CSV if new
if (-not (Test-Path $OutputFile) -or -not $Resume) {
    "CaseNum,Model,GA_Weeks,GA_Days,Temp_F,ROM_Hours,GBS_Status,Abx_Type,Abx_Duration,Clinical_Exam,KP_RiskAtBirth,KP_RiskPosterior,KP_Recommendation,Timestamp" | Out-File $OutputFile -Encoding UTF8
}

Write-Host "Total cases: $($casesToRun.Count)" -ForegroundColor White
Write-Host "Starting from: $startIndex" -ForegroundColor White
Write-Host ""

# Get initial page state
Write-Host "Fetching initial page state..." -ForegroundColor Gray
try {
    $pageState = Get-InitialPageState
    Write-Host "Got VIEWSTATE (length: $($pageState.ViewState.Length))" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Failed to fetch initial page: $_" -ForegroundColor Red
    exit 1
}

# Process each test case
for ($i = $startIndex; $i -lt $casesToRun.Count; $i++) {
    $case = $casesToRun[$i]
    $caseNum = $i + 1

    Write-Host "[$caseNum/$($casesToRun.Count)] Model=$($case.Model) GA=$($case.GAw)w$($case.GAd)d Temp=$($case.TempF)F ROM=$($case.ROM)h GBS=$($case.GBS) Clinical=$($case.Clinical)" -ForegroundColor White

    try {
        $response = Submit-CalculatorForm `
            -Session $pageState.Session `
            -ViewState $pageState.ViewState `
            -ViewStateGenerator $pageState.ViewStateGenerator `
            -EventValidation $pageState.EventValidation `
            -Inputs $case

        $result = Parse-CalculatorResponse -Response $response

        # Update page state from response for next request
        if ($response.InputFields) {
            $newViewState = ($response.InputFields | Where-Object { $_.name -eq "__VIEWSTATE" }).value
            if ($newViewState) { $pageState.ViewState = $newViewState }

            $newEventVal = ($response.InputFields | Where-Object { $_.name -eq "__EVENTVALIDATION" }).value
            if ($newEventVal) { $pageState.EventValidation = $newEventVal }
        }

        # Log result
        $csvLine = "$caseNum,$($case.Model),$($case.GAw),$($case.GAd),$($case.TempF),$($case.ROM),$($case.GBS),$($case.AbxType),$($case.AbxDur),$($case.Clinical),$($result.RiskAtBirth),$($result.RiskPosterior),`"$($result.Recommendation)`",$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        $csvLine | Out-File $OutputFile -Append -Encoding UTF8

        Write-Host "  -> Birth: $($result.RiskAtBirth) | Posterior: $($result.RiskPosterior)" -ForegroundColor Green

        # Save raw HTML for debugging (first few cases only)
        if ($i -lt 3) {
            $response.Content | Out-File "debug_response_$caseNum.html" -Encoding UTF8
        }
    }
    catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $csvLine = "$caseNum,$($case.Model),$($case.GAw),$($case.GAd),$($case.TempF),$($case.ROM),$($case.GBS),$($case.AbxType),$($case.AbxDur),$($case.Clinical),ERROR,ERROR,`"$_`",$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        $csvLine | Out-File $OutputFile -Append -Encoding UTF8
    }

    # Rate limiting - wait before next request
    if ($i -lt $casesToRun.Count - 1) {
        Write-Host "  Waiting $DelaySeconds seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $DelaySeconds
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPLETE! Data saved to: $OutputFile" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Summary
$data = Import-Csv $OutputFile
$successCount = ($data | Where-Object { $_.KP_RiskAtBirth -ne "ERROR" }).Count
Write-Host "Successful: $successCount / $($data.Count)" -ForegroundColor White
