import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppEnvironment, EnvConfig, PlausibleConfig } from './env';

/**
 * 環境変数をモックするためのヘルパー関数
 * 注意: import.meta.env の値は undefined ではなく空文字列で未設定を表現
 */
function createMockEnv(
  overrides: Partial<ImportMetaEnv> = {}
): Record<string, string> {
  const result: Record<string, string> = {
    VITE_APP_ENV: overrides.VITE_APP_ENV ?? '',
    VITE_DEBUG: overrides.VITE_DEBUG ?? '',
    VITE_APP_VERSION: overrides.VITE_APP_VERSION ?? '',
  };
  // オプショナルな環境変数は、明示的に指定された場合のみ設定
  if (overrides.VITE_SENTRY_DSN !== undefined) {
    result.VITE_SENTRY_DSN = overrides.VITE_SENTRY_DSN;
  }
  if (overrides.VITE_PLAUSIBLE_DOMAIN !== undefined) {
    result.VITE_PLAUSIBLE_DOMAIN = overrides.VITE_PLAUSIBLE_DOMAIN;
  }
  if (overrides.VITE_PLAUSIBLE_API_HOST !== undefined) {
    result.VITE_PLAUSIBLE_API_HOST = overrides.VITE_PLAUSIBLE_API_HOST;
  }
  if (overrides.VITE_GA4_MEASUREMENT_ID !== undefined) {
    result.VITE_GA4_MEASUREMENT_ID = overrides.VITE_GA4_MEASUREMENT_ID;
  }
  return result;
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

    const {
      env,
      isDevelopment,
      isProduction,
      isStaging,
      isSentryConfigured,
      isPlausibleConfigured,
      isGA4Configured,
      isAnalyticsConfigured,
    } = await import('./env');

    expect(env.appEnv).toBe('development');
    expect(env.debug).toBe(false);
    expect(env.appVersion).toBe('0.0.0');
    expect(env.sentryDsn).toBeUndefined();
    expect(env.plausible).toBeUndefined();
    expect(env.ga4MeasurementId).toBeUndefined();
    expect(isDevelopment).toBe(true);
    expect(isProduction).toBe(false);
    expect(isStaging).toBe(false);
    expect(isSentryConfigured()).toBe(false);
    expect(isPlausibleConfigured()).toBe(false);
    expect(isGA4Configured()).toBe(false);
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it('有効な環境値を正しく検証する - production', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_APP_ENV: 'production',
        VITE_DEBUG: 'true',
        VITE_APP_VERSION: '1.2.3',
        VITE_SENTRY_DSN: 'https://sentry.io/dsn',
        VITE_PLAUSIBLE_DOMAIN: 'example.com',
        VITE_PLAUSIBLE_API_HOST: 'https://plausible.example.com',
        VITE_GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',
      })
    );

    const {
      env,
      isDevelopment,
      isProduction,
      isStaging,
      isSentryConfigured,
      isPlausibleConfigured,
      isGA4Configured,
      isAnalyticsConfigured,
    } = await import('./env');

    expect(env.appEnv).toBe('production');
    expect(env.debug).toBe(true);
    expect(env.appVersion).toBe('1.2.3');
    expect(env.sentryDsn).toBe('https://sentry.io/dsn');
    expect(env.plausible).toEqual({
      domain: 'example.com',
      apiHost: 'https://plausible.example.com',
    });
    expect(env.ga4MeasurementId).toBe('G-XXXXXXXXXX');
    expect(isDevelopment).toBe(false);
    expect(isProduction).toBe(true);
    expect(isStaging).toBe(false);
    expect(isSentryConfigured()).toBe(true);
    expect(isPlausibleConfigured()).toBe(true);
    expect(isGA4Configured()).toBe(true);
    expect(isAnalyticsConfigured()).toBe(true);
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

  it('オプショナルな環境変数が空文字列の場合は undefined になる', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_SENTRY_DSN: '',
        VITE_PLAUSIBLE_DOMAIN: '',
        VITE_PLAUSIBLE_API_HOST: '',
        VITE_GA4_MEASUREMENT_ID: '',
      })
    );

    const { env } = await import('./env');

    expect(env.sentryDsn).toBeUndefined();
    expect(env.plausible).toBeUndefined();
    expect(env.ga4MeasurementId).toBeUndefined();
  });

  it('Plausible ドメインのみ設定された場合は apiHost は undefined になる', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_PLAUSIBLE_DOMAIN: 'example.com',
      })
    );

    const { env } = await import('./env');

    expect(env.plausible).toEqual({
      domain: 'example.com',
      apiHost: undefined,
    });
  });

  it('Plausible のみ設定された場合もアナリティクスが設定済みと判定される', async () => {
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_PLAUSIBLE_DOMAIN: 'example.com',
      })
    );

    const { isPlausibleConfigured, isGA4Configured, isAnalyticsConfigured } =
      await import('./env');

    expect(isPlausibleConfigured()).toBe(true);
    expect(isGA4Configured()).toBe(false);
    expect(isAnalyticsConfigured()).toBe(true);
  });

  it('GA4 のみ設定された場合もアナリティクスが設定済みと判定される', async () => {
    vi.resetModules();
    Object.assign(
      import.meta.env,
      createMockEnv({
        VITE_GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',
        VITE_PLAUSIBLE_DOMAIN: '', // 明示的に空を設定
      })
    );

    const { isPlausibleConfigured, isGA4Configured, isAnalyticsConfigured } =
      await import('./env');

    expect(isPlausibleConfigured()).toBe(false);
    expect(isGA4Configured()).toBe(true);
    expect(isAnalyticsConfigured()).toBe(true);
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
    expect(validConfig.sentryDsn).toBeUndefined();
    expect(validConfig.plausible).toBeUndefined();
    expect(validConfig.ga4MeasurementId).toBeUndefined();
  });

  it('EnvConfig にオプショナルなフィールドが含まれている', () => {
    const configWithOptionals: EnvConfig = {
      appEnv: 'production',
      debug: true,
      appVersion: '2.0.0',
      sentryDsn: 'https://sentry.io/dsn',
      plausible: {
        domain: 'example.com',
        apiHost: 'https://plausible.example.com',
      },
      ga4MeasurementId: 'G-XXXXXXXXXX',
    };

    expect(configWithOptionals.sentryDsn).toBe('https://sentry.io/dsn');
    expect(configWithOptionals.plausible?.domain).toBe('example.com');
    expect(configWithOptionals.plausible?.apiHost).toBe(
      'https://plausible.example.com'
    );
    expect(configWithOptionals.ga4MeasurementId).toBe('G-XXXXXXXXXX');
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

  it('PlausibleConfig 型が正しく定義されている', () => {
    const plausibleConfig: PlausibleConfig = {
      domain: 'example.com',
    };

    expect(plausibleConfig.domain).toBe('example.com');
    expect(plausibleConfig.apiHost).toBeUndefined();

    const plausibleConfigWithApiHost: PlausibleConfig = {
      domain: 'example.com',
      apiHost: 'https://plausible.example.com',
    };

    expect(plausibleConfigWithApiHost.apiHost).toBe(
      'https://plausible.example.com'
    );
  });
});
