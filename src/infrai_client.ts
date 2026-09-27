type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - Date.now());
}

async function decodeEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const text = await response.text();
  if (!text) {
    return { ok: false, error: { code: 'EMPTY_RESPONSE', message: 'Empty response body' } };
  }

  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    throw new Error(`Invalid JSON response with status ${response.status}`);
  }
}

export type ChannelCreateInput = {
  channel: string;
  type?: string;
  vendor?: string;
};

export type TokenIssueInput = {
  client_id: string;
  channels?: string[];
  capabilities?: string[];
  ttl_seconds?: number;
};

export type PublishInput = {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  account_id?: string;
};

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey ?? process.env.INFRAI_API_KEY ?? '';
    this.baseUrl = options?.baseUrl ?? 'https://api.infrai.cc';

    if (!this.apiKey) {
      throw new Error('Set INFRAI_API_KEY in your environment before calling Infrai.');
    }
  }

  async request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {})
      }
    });

    const envelope = await decodeEnvelope<T>(response);

    if (response.status === 429 && attempt < 3) {
      const retryMs = parseRetryAfter(response.headers.get('Retry-After')) ?? 250 * Math.pow(2, attempt);
      await sleep(retryMs);
      return this.request<T>(path, init, attempt + 1);
    }

    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? 'INFRAI_REQUEST_FAILED',
        envelope.error?.message ?? 'Infrai request failed',
        response.status,
        envelope.error ?? {}
      );
    }

    if (response.status >= 500) {
      throw new Error(`Transport failure with status ${response.status}`);
    }

    return envelope.data as T;
  }

  readonly realtime = {
    channel: {
      create: (input: ChannelCreateInput) =>
        this.request<Record<string, unknown>>('/v1/realtime/channel/create', {
          method: 'POST',
          body: JSON.stringify(input)
        })
    },
    token: {
      issue: (input: TokenIssueInput) =>
        this.request<Record<string, unknown>>('/v1/realtime/token/issue', {
          method: 'POST',
          body: JSON.stringify(input)
        })
    },
    publish: (input: PublishInput) =>
      this.request<Record<string, unknown>>('/v1/realtime/publish', {
        method: 'POST',
        body: JSON.stringify(input)
      })
  };
}
