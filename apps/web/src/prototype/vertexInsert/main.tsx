/**
 * PROTOTYPE (issue #63) — entry for `prototype-vertex-insert.html`.
 * Served by the Vite dev server only; not part of the production bundle.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { VertexInsertPrototype } from './VertexInsertPrototype';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <VertexInsertPrototype />
  </StrictMode>
);
