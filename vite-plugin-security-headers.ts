/**
 * Vite Security Headers Plugin
 *
 * This plugin adds security headers to the Vite dev server
 * and injects CSP meta tag into the production build.
 */

import type { Plugin } from 'vite';
import {
  getCSPDirectives,
  generateCSPHeader,
  SECURITY_HEADERS,
} from './src/config/security';

/**
 * Vite plugin that adds security headers to development server
 * and injects CSP meta tag into production HTML
 */
export function securityHeadersPlugin(): Plugin {
  return {
    name: 'security-headers',

    /**
     * Configure development server to add security headers
     */
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        // Set CSP header for development environment
        const csp = generateCSPHeader(getCSPDirectives('development'));
        res.setHeader('Content-Security-Policy', csp);

        // Set other security headers
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        next();
      });
    },

    /**
     * Transform index.html to inject CSP meta tag for production builds
     */
    transformIndexHtml(html) {
      // Only inject meta tag during build (production)
      const csp = generateCSPHeader(getCSPDirectives('production'));

      // Insert CSP meta tag after the opening <head> tag
      return html.replace(
        '<head>',
        `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">`
      );
    },
  };
}
