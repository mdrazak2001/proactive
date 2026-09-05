import type { BrokerConfig } from './config.js';
import { PublicError } from './errors.js';

interface UpstreamOptions {
  provider: string;
  config: BrokerConfig;
  acceptedStatuses?: readonly number[];
}

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new PublicError(
        502,
        'upstream_response_too_large',
        'The provider returned more data than this read-only check permits.',
      );
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

export async function upstreamRequest(
  url: string,
  init: RequestInit,
  options: UpstreamOptions,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(options.config.upstreamTimeoutMs),
    });
    const accepted = options.acceptedStatuses ?? [200];
    if (!accepted.includes(response.status)) {
      await response.body?.cancel();
      throw new PublicError(
        response.status === 401 || response.status === 403 ? 401 : 502,
        response.status === 401 || response.status === 403
          ? 'provider_authorization_failed'
          : 'provider_request_failed',
        response.status === 401 || response.status === 403
          ? `${options.provider} rejected the configured credential or scope.`
          : `${options.provider} could not complete the read-only check (HTTP ${response.status}).`,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof PublicError) throw error;
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new PublicError(
        504,
        'provider_timeout',
        `${options.provider} did not respond before the safety timeout.`,
      );
    }
    throw new PublicError(
      502,
      'provider_unreachable',
      `${options.provider} could not be reached by the connector broker.`,
    );
  }
}

export async function upstreamJson(
  url: string,
  init: RequestInit,
  options: UpstreamOptions,
): Promise<unknown> {
  const response = await upstreamRequest(url, init, options);
  let text: string;
  try {
    text = await readBoundedText(
      response,
      options.config.upstreamResponseLimitBytes,
    );
  } catch (error) {
    if (error instanceof PublicError) throw error;
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new PublicError(
        504,
        'provider_timeout',
        `${options.provider} did not respond before the safety timeout.`,
      );
    }
    throw new PublicError(
      502,
      'invalid_provider_response',
      `${options.provider} returned an incomplete response to the read-only check.`,
    );
  }
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublicError(
      502,
      'invalid_provider_response',
      `${options.provider} returned an invalid response to the read-only check.`,
    );
  }
}
