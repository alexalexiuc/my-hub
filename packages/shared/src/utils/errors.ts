/**
 * Shared error types.
 *
 * Exports:
 *   UserInputError — invalid input or missing setup; the message is written for the user. Hub routes
 *                    answer it with a 400 and MCP tools report it as a handled tool error.
 */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserInputError';
  }
}
