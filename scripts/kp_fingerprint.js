/**
 * KP EOS Calculator Fingerprint Checker
 *
 * This script fetches the Kaiser Permanente EOS Model Update FAQ page,
 * computes a fingerprint (hash) of its content, and compares it to
 * the expected fingerprint to detect changes.
 *
 * Run via: node scripts/kp_fingerprint.js
 * Or via GitHub Actions scheduled job
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KP_URL = 'https://neonatalsepsiscalculator.kaiserpermanente.org/ModelUpdateFAQ.aspx';
const STATUS_FILE = path.join(__dirname, '..', 'public', 'kp_status.json');

// Load current expected fingerprint
function loadExpectedFingerprint() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      return data.fingerprint_expected || '';
    }
  } catch (e) {
    console.error('Error loading status file:', e.message);
  }
  return '';
}

// Fetch URL content
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'NeoCalc-KP-Monitor/1.0'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Normalize HTML content for fingerprinting
// Remove dynamic elements that change frequently but don't indicate model changes
function normalizeContent(html) {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove viewstate and other ASP.NET hidden fields
    .replace(/<input[^>]*__VIEWSTATE[^>]*>/gi, '')
    .replace(/<input[^>]*__EVENTVALIDATION[^>]*>/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim();
}

// Compute hash of content
function computeFingerprint(content) {
  const normalized = normalizeContent(content);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

// Main function
async function main() {
  console.log('KP EOS Calculator Fingerprint Checker');
  console.log('=====================================');
  console.log(`URL: ${KP_URL}`);
  console.log('');

  const expectedFingerprint = loadExpectedFingerprint();
  console.log(`Expected fingerprint: ${expectedFingerprint || '(none set)'}`);

  let status = {
    last_checked_iso: new Date().toISOString(),
    fingerprint_current: '',
    fingerprint_expected: expectedFingerprint,
    status: 'error',
    source_url: KP_URL
  };

  try {
    console.log('Fetching page...');
    const html = await fetchUrl(KP_URL);
    console.log(`Received ${html.length} bytes`);

    const currentFingerprint = computeFingerprint(html);
    console.log(`Current fingerprint: ${currentFingerprint}`);

    status.fingerprint_current = currentFingerprint;

    if (!expectedFingerprint) {
      // First run - set expected to current
      console.log('No expected fingerprint set. Setting current as expected.');
      status.fingerprint_expected = currentFingerprint;
      status.status = 'ok';
    } else if (currentFingerprint === expectedFingerprint) {
      console.log('Fingerprints match. No change detected.');
      status.status = 'ok';
    } else {
      console.log('WARNING: Fingerprints do not match! Content may have changed.');
      status.status = 'changed';
    }
  } catch (error) {
    console.error('Error fetching page:', error.message);
    status.status = 'error';
  }

  // Write status file
  console.log('');
  console.log('Writing status file...');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  console.log(`Status: ${status.status}`);
  console.log(`Written to: ${STATUS_FILE}`);

  // Exit with error code if changed (for CI to detect)
  if (status.status === 'changed') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
