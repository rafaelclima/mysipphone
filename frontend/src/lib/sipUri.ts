/**
 * SIP URI validation and construction utilities.
 *
 * Valid SIP user part characters: alphanumeric, '-', '.', '_', '!', '~', '*', '+', '%23' (#), and '='.
 * See RFC 3261 §25.1 for SIP URI syntax.
 */

const SIP_USER_CHARS = /^[a-zA-Z0-9\-._!~*+#=]+$/;

export interface SipUriValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a raw user part (extension/number) for SIP URI.
 */
export function validateSipUserPart(input: string): SipUriValidation {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "empty" };
  }
  if (trimmed.length > 128) {
    return { valid: false, error: "too_long" };
  }
  if (!SIP_USER_CHARS.test(trimmed)) {
    return { valid: false, error: "invalid_chars" };
  }
  return { valid: true };
}

/**
 * Build a SIP URI from raw input and an optional domain.
 * Returns the validated URI or an error string.
 */
export function buildSipUri(
  raw: string,
  domain: string,
): { uri: string } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { error: "empty" };
  }

  // Already a full SIP URI
  if (trimmed.startsWith("sip:")) {
    return { uri: trimmed };
  }

  // user@domain format
  if (trimmed.includes("@")) {
    return { uri: `sip:${trimmed}` };
  }

  // Validate user part
  const validation = validateSipUserPart(trimmed);
  if (!validation.valid) {
    return { error: validation.error || "invalid" };
  }

  const encoded = trimmed.replace(/#/g, "%23");
  return { uri: domain ? `sip:${encoded}@${domain}` : `sip:${encoded}` };
}
