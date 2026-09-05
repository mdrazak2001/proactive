export class PublicError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PublicError';
  }
}

export function asPublicError(error: unknown): PublicError {
  if (error instanceof PublicError) return error;
  return new PublicError(500, 'internal_error', 'The connector broker could not complete the request.');
}
