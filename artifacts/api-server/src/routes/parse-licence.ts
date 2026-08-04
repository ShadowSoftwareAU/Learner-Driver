/**
 * POST /api/students/parse-licence
 *
 * Accepts base64-encoded images of the front and (optionally) back of a
 * Queensland driver licence and returns structured OCR data extracted via
 * OpenAI vision.
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "./users";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const bodySchema = z.object({
  frontBase64: z.string().min(1),
  frontMimeType: z.string().default("image/jpeg"),
  backBase64: z.string().optional(),
  backMimeType: z.string().optional(),
});

export interface ParsedLicenceData {
  surname?: string;
  firstName?: string;
  middleName?: string;
  fullName?: string;
  dateOfBirth?: string;       // ISO date string YYYY-MM-DD
  licenceClass?: string;      // e.g. "MR", "C"
  licenceType?: string;       // e.g. "O", "P1", "P2"
  licenceEffectiveDate?: string; // ISO date string
  licenceExpiry?: string;     // ISO date string
  licenceNumber?: string;     // e.g. "077873196"
  address?: string;           // Street address from rear
  cardNumber?: string;        // Card number from rear
}

router.post("/students/parse-licence", requireAuth, async (req: any, res): Promise<void> => {
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "frontBase64 is required" });
    return;
  }

  const { frontBase64, frontMimeType, backBase64, backMimeType } = parse.data;

  // Build the vision message content
  const content: any[] = [
    {
      type: "text",
      text: `You are an OCR assistant specialising in Australian driver licences.
Extract the following fields from the licence image(s) provided and return ONLY valid JSON — no markdown, no explanation, no code fences.

Fields to extract:
- surname: family name (appears in ALL CAPS on Queensland licences, first line below "Driver Licence" heading)
- firstName: given name(s) first part
- middleName: middle name if present
- dateOfBirth: in YYYY-MM-DD format (shown as "DOB DD Mon YYYY")
- licenceClass: the Class code (e.g. "MR", "C", "RE")
- licenceType: the Type code (e.g. "O" for Open, "P1", "P2", "L")
- licenceEffectiveDate: Effective date in YYYY-MM-DD format
- licenceExpiry: Expiry date in YYYY-MM-DD format
- licenceNumber: numeric licence/CRN digits only, no spaces (shown as "LICENCE NO / CRN")
- address: full street address if visible (top-left on rear of card)
- cardNumber: alphanumeric card number (shown as "Card number" on rear)

Return null for any field you cannot read clearly. Example output:
{
  "surname": "SMITH",
  "firstName": "Jordan",
  "middleName": null,
  "dateOfBirth": "1998-03-15",
  "licenceClass": "C",
  "licenceType": "P2",
  "licenceEffectiveDate": "2022-01-10",
  "licenceExpiry": "2026-01-09",
  "licenceNumber": "123456789",
  "address": null,
  "cardNumber": null
}`,
    },
    {
      type: "image_url",
      image_url: { url: `data:${frontMimeType};base64,${frontBase64}`, detail: "high" },
    },
  ];

  if (backBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${backMimeType ?? "image/jpeg"};base64,${backBase64}`, detail: "high" },
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [{ role: "user", content }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: Record<string, string | null>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(422).json({ error: "Could not parse OCR response", raw });
      return;
    }

    // Compose fullName from parts
    const parts = [parsed.firstName, parsed.middleName, parsed.surname]
      .filter(Boolean)
      .map(s => s!.trim());
    const fullName = parts.length > 0 ? parts.join(" ") : undefined;

    const result: ParsedLicenceData = {
      surname: parsed.surname ?? undefined,
      firstName: parsed.firstName ?? undefined,
      middleName: parsed.middleName ?? undefined,
      fullName,
      dateOfBirth: parsed.dateOfBirth ?? undefined,
      licenceClass: parsed.licenceClass ?? undefined,
      licenceType: parsed.licenceType ?? undefined,
      licenceEffectiveDate: parsed.licenceEffectiveDate ?? undefined,
      licenceExpiry: parsed.licenceExpiry ?? undefined,
      licenceNumber: parsed.licenceNumber ?? undefined,
      address: parsed.address ?? undefined,
      cardNumber: parsed.cardNumber ?? undefined,
    };

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "OCR service error", detail: err?.message });
  }
});

export default router;
