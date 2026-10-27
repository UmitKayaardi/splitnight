import { handleHealth } from '../server/handlers.js';

export function GET(): Response {
  return handleHealth();
}
