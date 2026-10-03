/**
 * Public entry point for the percent-encoding library.
 *
 * Re-exports the encoder and decoder so callers can `import { encode, decode }
 * from 'percent-encoding'` without reaching into `core`.
 */
export { encode, decode } from './core.js';
