import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleBrokerRequest } from '../server/src/handler.js';

export default async function brokerFunction(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await handleBrokerRequest(request, response);
}
