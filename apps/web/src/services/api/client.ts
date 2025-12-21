/**
 * API クライアント
 *
 * Rust バックエンドとの HTTP 通信を行う Axios インスタンス。
 * エラーハンドリングとデバッグログを統合。
 */

import { environment, isDebug } from '@/config/environment';
import type { ErrorResponse } from '@gridder/shared-types';

/**
 * API エラークラス
 *
 * バックエンドからのエラーレスポンスをラップするカスタムエラー
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * ネットワークエラークラス
 *
 * ネットワーク接続エラーをラップするカスタムエラー
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * HTTP リクエストオプション
 */
interface RequestOptions {
  /** HTTP メソッド */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** リクエストボディ */
  body?: unknown;
  /** 追加ヘッダー */
  headers?: Record<string, string>;
  /** タイムアウト（ミリ秒） */
  timeout?: number;
}

/**
 * デフォルトのタイムアウト（ミリ秒）
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * エラーレスポンスをパース
 */
const parseErrorResponse = async (response: Response): Promise<ErrorResponse | null> => {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as ErrorResponse;
  } catch {
    return null;
  }
};

/**
 * HTTP リクエストを実行
 *
 * @param endpoint - API エンドポイント（/api/... 形式）
 * @param options - リクエストオプション
 * @returns レスポンスデータ
 * @throws ApiError, NetworkError
 */
export const request = async <T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT } = options;

  const url = `${environment.apiUrl}${endpoint}`;

  // AbortController でタイムアウトを実装
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    if (isDebug()) {
      console.log(`[API] ${method} ${url}`, body);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await parseErrorResponse(response);
      const message = errorData?.message || `HTTP Error: ${response.status}`;
      const code = errorData?.code || 'UNKNOWN_ERROR';

      if (isDebug()) {
        console.error(`[API] Error: ${message}`, errorData);
      }

      throw new ApiError(message, code, response.status, errorData?.details);
    }

    // 204 No Content の場合は空オブジェクトを返す
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();

    if (isDebug()) {
      console.log(`[API] Response:`, data);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkError('リクエストがタイムアウトしました');
    }

    if (error instanceof TypeError) {
      throw new NetworkError('ネットワーク接続に失敗しました');
    }

    throw error;
  }
};

/**
 * GET リクエスト
 */
export const get = <T>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> => {
  return request<T>(endpoint, { ...options, method: 'GET' });
};

/**
 * POST リクエスト
 */
export const post = <T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> => {
  return request<T>(endpoint, { ...options, method: 'POST', body });
};

/**
 * PUT リクエスト
 */
export const put = <T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> => {
  return request<T>(endpoint, { ...options, method: 'PUT', body });
};

/**
 * DELETE リクエスト
 */
export const del = <T>(
  endpoint: string,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> => {
  return request<T>(endpoint, { ...options, method: 'DELETE' });
};

/**
 * API クライアントオブジェクト
 */
export const apiClient = {
  request,
  get,
  post,
  put,
  delete: del,
};
