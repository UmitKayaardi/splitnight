import { handleHealth } from '../server/handlers';

export function GET(): Response {
  return handleHealth();
}
