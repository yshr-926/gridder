/**
 * Content Security Policy (CSP) and Security Headers Configuration
 *
 * This module provides security header configurations to protect against:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing attacks
 * - Other common attack vectors
 */

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-ancestors': string[];
  'object-src': string[];
  'base-uri': string[];
}

export type Environment = 'development' | 'production';

/**
 * Generate CSP directives based on the environment
 *
 * @param env - The environment ('development' or 'production')
 * @returns CSP directives object
 */
export const getCSPDirectives = (env: Environment): CSPDirectives => {
  const base: CSPDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Tailwind CSS requires unsafe-inline
    'img-src': ["'self'", 'data:', 'blob:'], // Canvas export support (data: and blob: URLs)
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"], // Prevent iframe embedding (clickjacking protection)
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
  };

  if (env === 'development') {
    // Allow inline scripts for HMR and development tools in development
    base['script-src'].push("'unsafe-inline'");
    // Allow WebSocket connections for HMR in development
    base['connect-src'].push('ws:', 'wss:');
  }

  return base;
};

/**
 * Generate CSP header string from directives object
 *
 * @param directives - CSP directives object
 * @returns CSP header value string
 */
export const generateCSPHeader = (directives: CSPDirectives): string => {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};

/**
 * Generate CSP header for a specific environment
 *
 * @param env - The environment
 * @returns CSP header value string
 */
export const getCSPHeader = (env: Environment): string => {
  return generateCSPHeader(getCSPDirectives(env));
};

/**
 * Security headers that should be set on all responses
 *
 * These headers provide additional security protections:
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking (legacy, use CSP frame-ancestors)
 * - X-XSS-Protection: XSS filter (legacy, but still useful for older browsers)
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Restricts browser features
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Get all security headers including CSP for a specific environment
 *
 * @param env - The environment
 * @returns Object with all security headers
 */
export const getAllSecurityHeaders = (
  env: Environment
): Record<string, string> => {
  return {
    'Content-Security-Policy': getCSPHeader(env),
    ...SECURITY_HEADERS,
  };
};

/**
 * Production CSP header value (pre-computed for deployment configs)
 */
export const PRODUCTION_CSP_HEADER = getCSPHeader('production');

/**
 * Development CSP header value (pre-computed for dev server)
 */
export const DEVELOPMENT_CSP_HEADER = getCSPHeader('development');
