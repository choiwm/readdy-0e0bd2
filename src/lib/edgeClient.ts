import { supabase } from './supabase';
import { logError } from '@/utils/errorHandler';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

export interface CallEdgeOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class EdgeCallError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'EdgeCallError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

function buildUrl(fn: string, query?: CallEdgeOptions['query']): string {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${fn}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : { Authorization: `Bearer ${ANON_KEY ?? ''}` };
  } catch (err) {
    logError(err, { where: 'edgeClient.getAuthHeader' }, 'warn');
    return { Authorization: `Bearer ${ANON_KEY ?? ''}` };
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

/**
 * Supabase Edge Function 호출 공통 래퍼.
 * - 세션이 있으면 user access_token, 없으면 anon key 사용
 * - 타임아웃 + AbortSignal 지원
 * - 5xx 응답에 한해 재시도(지수 백오프)
 */
export async function callEdge<T = unknown>(fn: string, options: CallEdgeOptions = {}): Promise<T> {
  const {
    method = 'POST',
    body,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 1,
    headers: extraHeaders = {},
  } = options;

  const url = buildUrl(fn, query);
  const authHeaders = await getAuthHeader();

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    const attemptController = new AbortController();
    const onParentAbort = () => attemptController.abort();
    signal?.addEventListener('abort', onParentAbort, { once: true });
    const timeoutId = setTimeout(() => attemptController.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY ?? '',
          ...authHeaders,
          ...extraHeaders,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: attemptController.signal,
      });

      if (!resp.ok) {
        let code: string | undefined;
        let msg = `HTTP ${resp.status}`;
        try {
          const errJson = await resp.json() as { error?: string; message?: string; code?: string };
          msg = errJson.error ?? errJson.message ?? msg;
          code = errJson.code;
        } catch { /* 응답 본문이 JSON이 아님 */ }

        // 5xx는 재시도 가능, 4xx는 즉시 실패
        if (resp.status >= 500 && attempt < retries) {
          lastError = new EdgeCallError(msg, resp.status, code);
          await wait(2 ** attempt * 500, signal);
          attempt += 1;
          continue;
        }
        throw new EdgeCallError(msg, resp.status, code);
      }

      const text = await resp.text();
      return (text ? JSON.parse(text) : null) as T;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;
      if (attempt >= retries) {
        logError(err, { where: 'callEdge', fn, attempt }, 'error');
        throw err;
      }
      await wait(2 ** attempt * 500, signal);
      attempt += 1;
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onParentAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('callEdge failed');
}
