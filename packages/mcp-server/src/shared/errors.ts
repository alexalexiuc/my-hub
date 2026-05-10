export class HandledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandledError';
  }
}
