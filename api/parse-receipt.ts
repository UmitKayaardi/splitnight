import { handleParseReceipt } from '../server/handlers.js';

export function POST(request: Request): Promise<Response> {
  return handleParseReceipt(request);
}
