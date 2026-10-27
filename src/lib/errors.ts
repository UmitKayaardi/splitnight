import type { ErrorCode } from '../../shared/schemas';

/** Every failure the UI can explain: server error codes plus two the browser detects itself. */
export type ClientErrorCode = ErrorCode | 'OFFLINE' | 'NETWORK';

export class ClientApiError extends Error {
  constructor(readonly code: ClientErrorCode) {
    super(code);
    this.name = 'ClientApiError';
  }
}

export function errorCodeOf(error: unknown): ClientErrorCode {
  return error instanceof ClientApiError ? error.code : 'UPSTREAM';
}
