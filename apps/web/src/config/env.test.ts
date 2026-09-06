import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppEnvironment, EnvConfig } from './env';

/**
 * 環境変数をモックするためのヘルパー関数
 * 注意: import.meta.env の値は undefined ではなく空文字列で未設定を表現
 */
function createMockEnv(
  overrides: Partial<ImportMetaEnv> = {}
): Record<string, string> {
  return {
    VITE_APP_ENV: overrides.VITE_APP_ENV ?? '',
    VITE_DEBUG: overrides.VITE_DEBUG ?? '',
    VITE_APP_VERSION: overrides.VITE_APP_VERSION ?? '',
  };
}

describe('環境変数の検証', () => {
  // オリジナルの import.meta.env を保存
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // 環境変数を元に戻す
    Object.assign(import.meta.env, originalEnv);
  });

  it('デフォルト値が正しく設定される', async () => {
    // 環境変数を空に設定
    Object.assign(import.meta.env, createMockEnv());

    const { env, isDevelopment, isProduction, isStaging } = await import('./env');

    expect(env.appEnv).toBe('development');
    expect(env.debug).toBe(false);
    expect(env.appVersion).toBe('0.0.0');
    expect(isDevelopment).toBe(true);
    expect(isProduction).toBe(false);
    expect(isStaging).toBe(false);
  });

  it('有効な環境値を正しく検証する - production', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_APP_ENV: 'production',
        VITE_DEBUG: 'true',
        VITE_APP_VERSION: '1.2.3',
      })
    );

    const { env, isDevelopment, isProduction, isStaging } = await import('./env');

    expect(env.appEnv).toBe('production');
    expect(env.debug).toBe(true);
    expect(env.appVersion).toBe('1.2.3');
    expect(isDevelopment).toBe(false);
    expect(isProduction).toBe(true);
    expect(isStaging).toBe(false);
  });

  it('有効な環境値を正しく検証する - staging', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_APP_ENV: 'staging',
        VITE_DEBUG: 'false',
        VITE_APP_VERSION: '2.0.0-beta',
      })
    );

    const { env, isDevelopment, isProduction, isStaging } = await import(
      './env'
    );

    expect(env.appEnv).toBe('staging');
    expect(env.debug).toBe(false);
    expect(env.appVersion).toBe('2.0.0-beta');
    expect(isDevelopment).toBe(false);
    expect(isProduction).toBe(false);
    expect(isStaging).toBe(true);
  });

  it('無効な環境値はフォールバックされる', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_APP_ENV: 'invalid',
        VITE_DEBUG: 'not-a-boolean',
        VITE_APP_VERSION: '',
      })
    );

    const { env } = await import('./env');

    expect(env.appEnv).toBe('development'); // フォールバック
    expect(env.debug).toBe(false); // フォールバック
    expect(env.appVersion).toBe('0.0.0'); // フォールバック
  });

  it('デバッグモードは "true" 以外はすべて false になる', async () => {
    // "false" の場合
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_DEBUG: 'false',
      })
    );
    let result = await import('./env');
    expect(result.env.debug).toBe(false);

    // "1" の場合
    vi.resetModules();
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_DEBUG: '1',
      })
    );
    result = await import('./env');
    expect(result.env.debug).toBe(false);

    // "TRUE" (大文字) の場合
    vi.resetModules();
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_DEBUG: 'TRUE',
      })
    );
    result = await import('./env');
    expect(result.env.debug).toBe(false);
  });
});

describe('EnvConfig 型の検証', () => {
  it('EnvConfig インターフェースが正しく定義されている', () => {
    // 型チェックのためのコンパイル時テスト
    const validConfig: EnvConfig = {
      appEnv: 'development',
      debug: false,
      appVersion: '1.0.0',
    };

    expect(validConfig).toBeDefined();
    expect(validConfig.appEnv).toBe('development');
    expect(validConfig.debug).toBe(false);
    expect(validConfig.appVersion).toBe('1.0.0');
  });

  it('AppEnvironment 型が有効な値のみを許可する', () => {
    const environments: AppEnvironment[] = [
      'development',
      'staging',
      'production',
    ];

    expect(environments).toContain('development');
    expect(environments).toContain('staging');
    expect(environments).toContain('production');
    expect(environments).toHaveLength(3);
  });
});
