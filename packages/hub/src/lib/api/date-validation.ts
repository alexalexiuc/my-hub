/**
 * Parses and validates a date string from request body
 * @param value The value to parse (typically from req.body)
 * @param fieldName The field name for error messages
 * @returns An object with the parsed date (or null) and optional error message
 */
export function parseAndValidateDate(value: unknown, fieldName: string): { date: Date | null; error?: string } {
  // If not a string, return null date (not provided)
  if (typeof value !== 'string') {
    return { date: null };
  }

  // Parse the date string
  const parsed = new Date(value);

  // Check if parsing was successful
  if (Number.isNaN(parsed.getTime())) {
    return { date: null, error: `${fieldName} must be a valid datetime string` };
  }

  return { date: parsed };
}

/**
 * Parses and validates a date from a PATCH request body
 * Handles three cases:
 * - Field not provided → returns undefined (don't update)
 * - Field set to null → returns null (clear the date)
 * - Field set to a string → parses and validates
 * @param value The value to parse
 * @param fieldName The field name for error messages
 * @returns An object with the parsed date (Date | null | undefined) and optional error
 */
export function parseAndValidateDateForPatch(
  value: unknown,
  fieldName: string,
): { date: Date | null | undefined; error?: string } {
  // If explicitly set to null, return null (allows clearing the field)
  if (value === null) {
    return { date: null };
  }

  // If not provided at all, return undefined (field not being updated)
  if (typeof value !== 'string') {
    return { date: undefined };
  }

  // If empty string, treat as null (clearing the field)
  if (value === '') {
    return { date: null };
  }

  // Parse the date string
  const parsed = new Date(value);

  // Check if parsing was successful
  if (Number.isNaN(parsed.getTime())) {
    return { date: undefined, error: `${fieldName} must be a valid datetime string` };
  }

  return { date: parsed };
}
