/**
 * SHAIVIKA IT TECHNOLOGIES — LEADS SUPABASE MIGRATION SCRIPT
 *
 * Reads existing leads from data/leads.backup.json (or data/leads.json),
 * validates records, and idempotently imports them into Supabase PostgreSQL.
 *
 * Requirements:
 * - Idempotent: checks for legacy_id before inserting
 * - Preserves original created_at timestamp
 * - Preserves original status
 * - Validates email and required fields
 * - Requires explicit --confirm flag to execute inserts
 *
 * Usage:
 *   node scripts/migrate-leads-to-supabase.cjs --dry-run
 *   node scripts/migrate-leads-to-supabase.cjs --confirm
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

function normalizeStatus(status) {
  if (!status) return 'New';
  const found = ALLOWED_STATUSES.find(s => s.toLowerCase() === String(status).toLowerCase().trim());
  return found || 'New';
}

function parseLaunchDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }
  return null;
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm');
  const isDryRun = args.includes('--dry-run') || !isConfirm;

  console.log('====================================================');
  console.log('SHAIVIKA IT TECHNOLOGIES — SUPABASE LEADS MIGRATION');
  console.log('Mode:', isConfirm ? 'LIVE MIGRATION (--confirm)' : 'DRY-RUN (Pass --confirm to execute)');
  console.log('====================================================\n');

  // Load environment variables
  const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : null;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  if (isConfirm && (!supabaseUrl || !supabaseServiceKey)) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    console.error('Example:');
    console.error('  $env:SUPABASE_URL="https://xyz.supabase.co"');
    console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
    console.error('  node scripts/migrate-leads-to-supabase.cjs --confirm');
    process.exit(1);
  }

  // Locate source JSON file
  let jsonPath = path.join(__dirname, '..', 'data', 'leads.backup.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(__dirname, '..', 'data', 'leads.json');
  }

  if (!fs.existsSync(jsonPath)) {
    console.log(`Source JSON file not found at ${jsonPath}. Nothing to migrate.`);
    return;
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let records;
  try {
    records = JSON.parse(raw || '[]');
  } catch (err) {
    console.error(`Invalid JSON in ${jsonPath}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(records) || records.length === 0) {
    console.log('No historical leads found in JSON. Migration complete.');
    console.log('\nMigration Summary:');
    console.log('Total records: 0');
    console.log('Imported: 0');
    console.log('Skipped duplicates: 0');
    console.log('Failed: 0');
    return;
  }

  console.log(`Found ${records.length} records in ${path.basename(jsonPath)}.\n`);

  let imported = 0;
  let skippedDuplicates = 0;
  let failed = 0;

  // Fetch existing legacy_ids from Supabase if live
  let existingLegacyIds = new Set();
  let existingEmails = new Set();

  if (isConfirm && supabaseUrl && supabaseServiceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/leads?select=id,legacy_id,email&limit=10000`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        rows.forEach(r => {
          if (r.legacy_id) existingLegacyIds.add(String(r.legacy_id));
          if (r.email) existingEmails.add(String(r.email).toLowerCase());
        });
        console.log(`Supabase existing records: ${rows.length} loaded for duplicate checking.`);
      }
    } catch (fetchErr) {
      console.warn('Could not pre-fetch existing records:', fetchErr.message);
    }
  }

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const legacyId = r.id || r.leadId || `legacy_${i}`;
    const name = (r.name || r.fullName || '').trim();
    const email = (r.email || '').trim().toLowerCase();
    const description = (r.description || r.message || '').trim();

    // Basic record validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !emailRegex.test(email) || !description) {
      console.warn(`[Skip Invalid] Record #${i + 1} (${name || 'No Name'}, ${email || 'No Email'}) missing required fields.`);
      failed++;
      continue;
    }

    // Check duplicate
    if (existingLegacyIds.has(String(legacyId))) {
      console.log(`[Duplicate] Record #${i + 1} (${legacyId}) already imported into Supabase. Skipping.`);
      skippedDuplicates++;
      continue;
    }

    const createdAt = r.createdAt || r.submittedAt || r.timestamp || new Date().toISOString();
    const launchDate = parseLaunchDate(r.launchDate || r.launch_date);

    const leadPayload = {
      name,
      email,
      company: r.company || null,
      country: r.country || null,
      phone: r.phone || null,
      contact_method: r.contactMethod || r.contact_method || 'Email',
      project_type: r.projectType || r.project_type || r.service || 'General',
      budget: r.budget || null,
      launch_date: launchDate,
      description,
      source: r.source || 'website-migration',
      status: normalizeStatus(r.status),
      legacy_id: String(legacyId),
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isDryRun) {
      console.log(`[Dry-Run Valid] Record #${i + 1}: ${name} <${email}> (${leadPayload.project_type})`);
      imported++;
    } else {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(leadPayload)
        });

        if (res.ok) {
          console.log(`[Imported] Record #${i + 1}: ${name} <${email}> -> Supabase`);
          existingLegacyIds.add(String(legacyId));
          imported++;
        } else {
          const errBody = await res.text().catch(() => '');
          console.error(`[Failed] Record #${i + 1}: Status ${res.status}`, errBody);
          failed++;
        }
      } catch (insertErr) {
        console.error(`[Error] Record #${i + 1}:`, insertErr.message);
        failed++;
      }
    }
  }

  console.log('\n========================================');
  console.log('MIGRATION SUMMARY');
  console.log('========================================');
  console.log(`Total records: ${records.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped duplicates: ${skippedDuplicates}`);
  console.log(`Failed: ${failed}`);
  console.log('========================================\n');

  if (isDryRun && records.length > 0) {
    console.log('To execute this migration against Supabase, run with --confirm:');
    console.log('  node scripts/migrate-leads-to-supabase.cjs --confirm\n');
  }
}

runMigration().catch(err => {
  console.error('Migration encountered fatal error:', err);
  process.exit(1);
});
