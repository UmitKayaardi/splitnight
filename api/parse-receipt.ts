import { handleParseReceipt } from '../server/handlers';

export function POST(request: Request): Promise<Response> {
  return handleParseReceipt(request);
}
