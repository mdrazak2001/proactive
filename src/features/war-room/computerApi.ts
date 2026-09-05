import { BrokerRequestError } from '../integrations/api';

export type ComputerStreamEvent =
  | { type: 'session'; sessionId: string; liveViewUrl: string }
  | { type: 'action'; step: number; actions: string[]; path: string }
  | { type: 'approval_required'; message: string }
  | { type: 'completed'; summary: string; steps: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageFrom(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  if (typeof value.message === 'string') return value.message;
  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message;
  }
  return fallback;
}

function codeFrom(value: unknown): string {
  if (!isRecord(value)) return '';
  if (typeof value.code === 'string') return value.code;
  if (isRecord(value.error) && typeof value.error.code === 'string') {
    return value.error.code;
  }
  return '';
}

function parseEvent(value: unknown): ComputerStreamEvent | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  switch (value.type) {
    case 'session':
      return typeof value.sessionId === 'string' && typeof value.liveViewUrl === 'string'
        ? { type: 'session', sessionId: value.sessionId, liveViewUrl: value.liveViewUrl }
        : undefined;
    case 'action':
      return typeof value.step === 'number' &&
        Array.isArray(value.actions) &&
        value.actions.every((action) => typeof action === 'string') &&
        typeof value.path === 'string'
        ? { type: 'action', step: value.step, actions: value.actions, path: value.path }
        : undefined;
    case 'approval_required':
      return typeof value.message === 'string'
        ? { type: 'approval_required', message: value.message }
        : undefined;
    case 'completed':
      return typeof value.summary === 'string' && typeof value.steps === 'number'
        ? { type: 'completed', summary: value.summary, steps: value.steps }
        : undefined;
    default:
      return undefined;
  }
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function dispatchBlock(
  block: string,
  onEvent: (event: ComputerStreamEvent) => void,
): boolean {
  if (!block || block.startsWith(':')) return false;
  let eventName = '';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return false;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join('\n')) as unknown;
  } catch {
    throw new BrokerRequestError('The computer stream returned invalid data.');
  }
  if (eventName === 'error') {
    throw new BrokerRequestError(
      messageFrom(payload, 'The computer run failed.'),
      0,
      codeFrom(payload),
    );
  }
  const event = parseEvent(payload);
  if (!event) return false;
  onEvent(event);
  return event.type === 'completed' || event.type === 'approval_required';
}

export async function runComputer(
  goal: string,
  idToken: string,
  onEvent: (event: ComputerStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/computer/run', {
      method: 'POST',
      credentials: 'same-origin',
      signal,
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ goal }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new BrokerRequestError('The computer broker is offline.');
  }

  if (!response.ok) {
    const payload = await responsePayload(response);
    throw new BrokerRequestError(
      messageFrom(payload, `Computer request failed (${response.status}).`),
      response.status,
      codeFrom(payload),
    );
  }
  if (!response.body) {
    throw new BrokerRequestError('The computer broker did not open a live stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      completed = dispatchBlock(buffer.slice(0, boundary), onEvent) || completed;
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  if (buffer.trim()) completed = dispatchBlock(buffer.trim(), onEvent) || completed;
  if (!completed && !signal.aborted) {
    throw new BrokerRequestError('The computer stream ended before the run completed.');
  }
}
