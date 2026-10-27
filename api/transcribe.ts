import { handleTranscribe } from '../server/handlers';

export function POST(request: Request): Promise<Response> {
  return handleTranscribe(request);
}
