/**
 * Content filtering rule sets.
 * Deterministic, explainable rules — no black-box-only moderation in Phase 2.
 * Future: plug in provider-based moderation alongside these rules.
 */

export type RuleCategory =
  | "profanity"
  | "sexual_inappropriate"
  | "grooming"
  | "threat_violence"
  | "self_harm"
  | "pii_sharing";

export type RuleHit = {
  rule: string;
  category: RuleCategory;
  excerpt: string;
  severity: "low" | "medium" | "high" | "critical";
};

export type ScanResult = {
  status: "approved" | "flagged" | "quarantined";
  severity: "low" | "medium" | "high" | "critical" | null;
  ruleHits: RuleHit[];
  normalizedText: string;
  requiresReview: boolean;
};

// ─── PII patterns ─────────────────────────────────────────────────────────────
const PHONE_PATTERN = /\b(\+?61|0)[2-478]\d{8}\b|\b\d{4}[\s-]\d{3}[\s-]\d{3}\b/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const SOCIAL_HANDLE_PATTERN = /(?:@[a-zA-Z0-9_.]{3,}|snap(?:chat)?:?\s*\w+|insta(?:gram)?:?\s*\w+|tiktok:?\s*\w+)/i;
const ADDRESS_PATTERN = /\b\d+\s+[A-Za-z]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ct|court|blvd|boulevard|ln|lane|way|pl|place)\b/i;

// ─── Grooming indicators ───────────────────────────────────────────────────────
const GROOMING_PHRASES = [
  /don'?t\s+tell\s+(your\s+)?(parents?|mum|mum|mom|guardians?)/i,
  /keep\s+(this|it)\s+(between\s+us|secret|private)/i,
  /\bwanna\s+meet\s+(up|outside|after|privately)\b/i,
  /\balone\s+(with\s+(me|you)|time)\b/i,
  /\bspecial\s+(friend|relationship)\b/i,
  /\bcome\s+to\s+my\s+(place|house|home|car)\b/i,
];

// ─── Threat / violence indicators ─────────────────────────────────────────────
const THREAT_PHRASES = [
  /\b(kill|hurt|harm|attack|threaten|beat)\s+(you|them|him|her)\b/i,
  /\byou'?re\s+(dead|going\s+to\s+regret)\b/i,
  /\bi'?ll\s+(kill|hurt|find|get)\s+you\b/i,
];

// ─── Self-harm indicators ──────────────────────────────────────────────────────
const SELF_HARM_PHRASES = [
  /\b(want\s+to\s+)?(kill|hurt)\s+(my)?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[\s-]harm\b/i,
  /\b(end\s+it\s+all|end\s+my\s+life)\b/i,
];

// ─── Basic profanity list (abbreviated — extend via config) ───────────────────
const PROFANITY_WORDS = new Set([
  "fuck", "shit", "cunt", "bitch", "bastard", "arsehole", "asshole",
  "dick", "cock", "wanker", "twat",
]);

function excerpt(text: string, index: number, padding = 30): string {
  const start = Math.max(0, index - padding);
  const end = Math.min(text.length, index + padding);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function scanText(text: string): ScanResult {
  const normalized = text.trim().toLowerCase();
  const hits: RuleHit[] = [];

  // PII — phone
  const phoneMatch = PHONE_PATTERN.exec(text);
  if (phoneMatch) {
    hits.push({ rule: "phone_number_detected", category: "pii_sharing", excerpt: excerpt(text, phoneMatch.index), severity: "high" });
  }

  // PII — email
  const emailMatch = EMAIL_PATTERN.exec(text);
  if (emailMatch) {
    hits.push({ rule: "email_address_detected", category: "pii_sharing", excerpt: excerpt(text, emailMatch.index), severity: "high" });
  }

  // PII — social handle
  const socialMatch = SOCIAL_HANDLE_PATTERN.exec(text);
  if (socialMatch) {
    hits.push({ rule: "social_handle_detected", category: "pii_sharing", excerpt: excerpt(text, socialMatch.index), severity: "high" });
  }

  // PII — address
  const addrMatch = ADDRESS_PATTERN.exec(text);
  if (addrMatch) {
    hits.push({ rule: "address_pattern_detected", category: "pii_sharing", excerpt: excerpt(text, addrMatch.index), severity: "medium" });
  }

  // Grooming
  for (const pattern of GROOMING_PHRASES) {
    const m = pattern.exec(text);
    if (m) {
      hits.push({ rule: `grooming_phrase:${pattern.source.slice(0, 40)}`, category: "grooming", excerpt: excerpt(text, m.index), severity: "critical" });
    }
  }

  // Threats
  for (const pattern of THREAT_PHRASES) {
    const m = pattern.exec(text);
    if (m) {
      hits.push({ rule: `threat:${pattern.source.slice(0, 40)}`, category: "threat_violence", excerpt: excerpt(text, m.index), severity: "critical" });
    }
  }

  // Self-harm
  for (const pattern of SELF_HARM_PHRASES) {
    const m = pattern.exec(text);
    if (m) {
      hits.push({ rule: `self_harm:${pattern.source.slice(0, 40)}`, category: "self_harm", excerpt: excerpt(text, m.index), severity: "critical" });
    }
  }

  // Profanity
  const words = normalized.split(/\W+/);
  for (const word of words) {
    if (PROFANITY_WORDS.has(word)) {
      const idx = normalized.indexOf(word);
      hits.push({ rule: `profanity:${word}`, category: "profanity", excerpt: excerpt(text, idx), severity: "medium" });
      break; // one hit per scan for profanity to avoid flooding
    }
  }

  if (hits.length === 0) {
    return { status: "approved", severity: null, ruleHits: [], normalizedText: normalized, requiresReview: false };
  }

  // Determine overall severity
  const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const topHit = hits.reduce((a, b) => severityOrder[a.severity] >= severityOrder[b.severity] ? a : b);
  const overallSeverity = topHit.severity;

  // critical/high → quarantine; medium/low → flagged
  const status = overallSeverity === "critical" || overallSeverity === "high" ? "quarantined" : "flagged";
  const requiresReview = status === "quarantined" || overallSeverity === "high";

  return { status, severity: overallSeverity, ruleHits: hits, normalizedText: normalized, requiresReview };
}
