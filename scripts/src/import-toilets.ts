/**
 * Import the National Public Toilet Map CSV into the public_toilets table.
 *
 * Usage:
 *   1. Download the CSV from:
 *        https://www.toiletmap.gov.au/  (look for Export / Download link)
 *      OR the data.gov.au dataset (search "National Public Toilet Map")
 *   2. Run:
 *        pnpm --filter @workspace/scripts run import-toilets -- /path/to/toiletmapexport.csv
 *
 * The script is safe to re-run: existing rows (matched by govId) are skipped.
 */
import { readFileSync } from "fs";
import { db, publicToiletsTable } from "@workspace/db";

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cols.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (cols[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function bool(val: string): boolean {
  return val === "True" || val === "true" || val === "1" || val === "YES";
}

async function main() {
  const csvPath = process.argv[2] ?? "./toiletmapexport.csv";
  console.log(`Reading CSV from: ${csvPath}`);

  let content: string;
  try {
    content = readFileSync(csvPath, "utf-8");
  } catch {
    console.error(`Could not read file: ${csvPath}`);
    console.error("Download the National Public Toilet Map CSV and pass its path as the first argument.");
    process.exit(1);
  }

  const records = parseCSV(content);
  console.log(`Parsed ${records.length} rows`);

  const rows = records
    .filter(r => r.Latitude && r.Longitude && parseFloat(r.Latitude) !== 0 && parseFloat(r.Longitude) !== 0)
    .map(r => ({
      govId: r.ToiletID || null,
      name: r.Name || "Public Toilet",
      lat: parseFloat(r.Latitude),
      lng: parseFloat(r.Longitude),
      state: r.State || null,
      suburb: r.Suburb || r.Town || null,
      address: [r.AddressLine1, r.AddressLine2].filter(Boolean).join(", ") || null,
      male: bool(r.Male),
      female: bool(r.Female),
      unisex: bool(r.Unisex),
      wheelchairAccessible: bool(r.AccessibleMale) || bool(r.AccessibleFemale) || bool(r.AccessibleUnisex),
      isOpen24h: bool(r.IsOpen24Hours),
      openingHours: r.OpeningHoursSchedule || null,
      paymentRequired: bool(r.PaymentRequired),
      mlakRequired: bool(r.MLAK),
      babyChange: bool(r.ParentRoom),
      showers: bool(r.Showers),
      drinkingWater: bool(r.DrinkingWater),
      notes: r.FacilityNote || r.FacilitiesNote || null,
    }));

  console.log(`Valid rows with coordinates: ${rows.length}`);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.insert(publicToiletsTable).values(batch).onConflictDoNothing();
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${rows.length} processed`);
  }
  console.log(`\nDone! Processed ${inserted} rows (duplicates skipped).`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
