import { handleAssign } from '../server/handlers.js';

export function POST(request: Request): Promise<Response> {
  return handleAssign(request);
}
