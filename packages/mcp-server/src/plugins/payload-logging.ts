import { REDACTED_PLACEHOLDER, SENSITIVE_FIELDS } from '../config/constants';

const MAX_PAYLOAD_BYTES = 10_240; // 10 KB cap per payload field

export function redactSensitiveFields(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveFields(item));
  }

  if (typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        output[key] = REDACTED_PLACEHOLDER;
      } else {
        output[key] = redactSensitiveFields(nested);
      }
    }
    return output;
  }

  return value;
}

/** Truncate a JSON-serialisable value to MAX_PAYLOAD_BYTES (serialised). */
export function capPayload(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const serialised = JSON.stringify(value);
  if (serialised.length <= MAX_PAYLOAD_BYTES) return value;
  return { _truncated: true, preview: serialised.slice(0, MAX_PAYLOAD_BYTES) };
}
