/**
 * verification-ocr.ts
 *
 * Async AI OCR for instructor verification documents.
 * Called after documents are inserted; updates ocrData + ocrStatus in place.
 * Non-fatal: failures are logged and recorded on the row, never surface to the instructor.
 */

import { eq } from "drizzle-orm";
import { db, verificationDocumentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const objectStorageService = new ObjectStorageService();

// ── Doc-type prompts ─────────────────────────────────────────────────────────

const PROMPTS: Record<string, string> = {
  wwcc: `Extract these fields from this Working With Children Check (WWCC) card image.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "cardNumber": "e.g. WWC1234567E",
  "fullName": "Name printed on card",
  "cardType": "Employee or Volunteer",
  "expiryDate": "YYYY-MM-DD",
  "issueDate": "YYYY-MM-DD",
  "issuingState": "QLD, NSW, VIC etc."
}`,

  insurance: `Extract these fields from this insurance certificate / policy schedule.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "policyNumber": "Policy or certificate number",
  "insurer": "Insurance company name",
  "insuredName": "Insured party name / entity",
  "coverageType": "e.g. Public Liability, Professional Indemnity",
  "coverageAmount": "e.g. $20,000,000",
  "effectiveDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD"
}`,

  license_front: `Extract these fields from the FRONT of this Australian driver licence.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "licenceNumber": "Licence number / CRN digits only",
  "fullName": "Full name on licence",
  "dateOfBirth": "YYYY-MM-DD",
  "licenceClass": "e.g. MR, C, RE",
  "licenceType": "e.g. O (Open), P1, P2",
  "effectiveDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD"
}`,

  license_back: `Extract these fields from the BACK/REAR of this Australian driver licence.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "address": "Full street address",
  "cardNumber": "Card number (alphanumeric, rear of card)",
  "conditions": "Any conditions or restrictions printed"
}`,

  driver_trainer_accreditation: `Extract these fields from this driver trainer accreditation certificate or card.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "accreditationNumber": "Accreditation or certificate number",
  "fullName": "Name on certificate",
  "issuingBody": "e.g. ADTA, TMR, VicRoads",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "qualificationType": "e.g. Certificate IV in Driver Training"
}`,

  first_aid: `Extract these fields from this first aid certificate.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "certificateNumber": "Certificate or statement number",
  "fullName": "Name on certificate",
  "provider": "Training provider / RTO name",
  "courseName": "e.g. HLTAID011 Provide First Aid",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD"
}`,

  rider_trainer_accreditation: `Extract these fields from this rider trainer accreditation certificate or card.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "accreditationNumber": "Accreditation or certificate number",
  "fullName": "Name on certificate",
  "issuingBody": "e.g. ADTA, MQ Solutions, MRAA",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "riderType": "e.g. Q-Ride, RE, R"
}`,

  qualification: `Extract these fields from this qualification certificate or transcript.
Return ONLY valid JSON with these keys (null for any you cannot read clearly):
{
  "qualificationName": "Full name of the qualification",
  "certificateNumber": "Certificate or statement number",
  "institution": "Issuing institution / RTO name",
  "issueDate": "YYYY-MM-DD",
  "studentName": "Name on certificate"
}`,
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MIME_MAP: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
};

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export async function scanVerificationDocument(
  docId: number,
  objectPath: string,
  docType: string,
  fileName: string,
): Promise<void> {
  const ext = extOf(fileName);

  // Skip PDFs — vision API only handles images
  if (!IMAGE_EXTENSIONS.has(ext)) {
    await db
      .update(verificationDocumentsTable)
      .set({ ocrStatus: "skipped", ocrData: { note: "OCR is only available for image files. Please review this document manually." } })
      .where(eq(verificationDocumentsTable.id, docId));
    return;
  }

  // Mark as processing
  await db
    .update(verificationDocumentsTable)
    .set({ ocrStatus: "processing" })
    .where(eq(verificationDocumentsTable.id, docId));

  try {
    // Fetch file bytes from object storage
    const gcsFile = await objectStorageService.getObjectEntityFile(objectPath);
    const [buffer] = await gcsFile.download();
    const base64 = buffer.toString("base64");
    const mimeType = MIME_MAP[ext] ?? "image/jpeg";

    const prompt = PROMPTS[docType] ?? `Extract all key fields from this document as JSON. Return ONLY valid JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Strip markdown code fences if model wrapped output
      const stripped = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(stripped);
    }

    await db
      .update(verificationDocumentsTable)
      .set({ ocrStatus: "done", ocrData: parsed })
      .where(eq(verificationDocumentsTable.id, docId));

    logger.info({ docId, docType }, "Verification document OCR completed");
  } catch (err: any) {
    logger.error({ docId, docType, err: err?.message }, "Verification document OCR failed");
    await db
      .update(verificationDocumentsTable)
      .set({ ocrStatus: "failed", ocrData: { error: err?.message ?? "Unknown error" } })
      .where(eq(verificationDocumentsTable.id, docId));
  }
}
