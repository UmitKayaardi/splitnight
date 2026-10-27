import { handleAssign } from '../server/handlers';

export function POST(request: Request): Promise<Response> {
  return handleAssign(request);
}
