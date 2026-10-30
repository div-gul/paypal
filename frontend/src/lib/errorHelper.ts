import { ApiError } from '../api/client';

/**
 * Normalizes any server, client, or unknown error into a friendly message for display.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unable to complete request. Please check your connection.';
}
