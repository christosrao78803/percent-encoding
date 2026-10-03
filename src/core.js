/**
 * Core percent-encoding logic for URL-safe string transport.
 *
 * Design choice: we operate at the byte level via UTF-8, not the code-point
 * level. This means a string containing characters outside the BMP (which
 * JavaScript represents as surrogate pairs) is encoded as its full UTF-8
 * byte sequence. Decoding reverses this by reassembling bytes into a UTF-8
 * string. This matches how `application/x-www-form-urlencoded` and the WHATWG
 * URL spec treat path/query components, and it keeps the encoding stable
 * across environments that disagree on surrogate handling.
 */

/**
 * Characters that are left unescaped because they are already URL-safe.
 *
 * We intentionally keep this set small and conservative: ASCII letters,
 * digits, and the four symbols `-_.~` that RFC 3986 marks as "unreserved".
 * Everything else — including characters like `/` and `:` that some URL
 * components allow — is escaped. This makes the encoding a single, uniform
 * transform regardless of where the output will be placed.
 */
const UNESCAPED = /^[A-Za-z0-9\-_.~]$/;

/**
 * Convert a JS string into its UTF-8 byte sequence.
 *
 * `TextEncoder` is the idiomatic, standard-library way to do this in both
 * browsers and Node. It always emits UTF-8 and never inserts a BOM, which is
 * exactly what percent-encoding requires.
 */
function stringToUtf8Bytes(input) {
  return new TextEncoder().encode(input);
}

/**
 * Reassemble a UTF-8 byte sequence back into a JS string.
 *
 * `TextDecoder` with the `fatal: true` option rejects malformed sequences
 * rather than silently substituting U+FFFD. We surface that as a thrown
 * `URIError` so callers can distinguish a bad input from an empty one.
 */
function utf8BytesToString(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Encode a string into a URL-safe percent-escaped form.
 *
 * Each byte that is not in the unreserved set is emitted as `%XX`, where `XX`
 * is the uppercase hexadecimal representation of the byte value. Uppercase is
 * mandated by RFC 3986 §2.1 for consistency, and some downstream consumers
 * (notably certain signing schemes) are case-sensitive on the escape.
 *
 * @param {string} input - The string to encode. An empty string is valid and
 *   returns an empty string.
 * @returns {string} The percent-encoded representation.
 * @throws {TypeError} if `input` is not a string.
 */
export function encode(input) {
  if (typeof input !== 'string') {
    throw new TypeError(`encode() expected a string, got ${typeof input}`);
  }

  const bytes = stringToUtf8Bytes(input);
  let out = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const ch = String.fromCharCode(byte);
    if (UNESCAPED.test(ch)) {
      out += ch;
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }

  return out;
}

/**
 * Decode a percent-escaped string back into its original form.
 *
 * The input is treated as a sequence of ASCII bytes; percent triplets are
 * unpacked into their raw byte values and the resulting byte sequence is
 * interpreted as UTF-8. Lowercase hex digits are accepted — RFC 3986 allows
 * either case, even though `encode` always emits uppercase.
 *
 * @param {string} input - The percent-encoded string to decode.
 * @returns {string} The decoded string.
 * @throws {TypeError} if `input` is not a string.
 * @throws {URIError} if the input contains a malformed escape sequence or if
 *   the decoded bytes are not valid UTF-8.
 */
export function decode(input) {
  if (typeof input !== 'string') {
    throw new TypeError(`decode() expected a string, got ${typeof input}`);
  }

  const bytes = [];

  for (let i = 0; i < input.length; ) {
    const ch = input[i];

    if (ch === '%') {
      if (i + 2 >= input.length) {
        throw new URIError(`Truncated percent escape at position ${i}`);
      }
      const hi = input[i + 1];
      const lo = input[i + 2];
      const code = parseHexPair(hi, lo);
      if (code === null) {
        throw new URIError(
          `Invalid hex digit in percent escape at position ${i}: "${input.slice(i, i + 3)}"`,
        );
      }
      bytes.push(code);
      i += 3;
    } else {
      // Non-`%` characters are taken literally as their ASCII code points.
      // Any byte above 0x7F would not be produced by `encode`, but we
      // still push its code unit so a hand-crafted input round-trips
      // rather than throwing — the UTF-8 decoder will catch true garbage.
      const code = ch.codePointAt(0);
      if (code === undefined) {
        throw new URIError(`Unpaired surrogate at position ${i}`);
      }
      // codePointAt can return a value > 0xFF for astral characters;
      // percent-encoding is byte-oriented, so we reject those here.
      if (code > 0xff) {
        throw new URIError(
          `Non-byte character U+${code.toString(16).toUpperCase()} at position ${i}; decode expects byte-oriented input`,
        );
      }
      bytes.push(code);
      i += 1;
    }
  }

  try {
    return utf8BytesToString(Uint8Array.from(bytes));
  } catch (err) {
    throw new URIError(`Decoded bytes are not valid UTF-8: ${err.message}`);
  }
}

/**
 * Parse two hex characters into a byte value, or return `null` if either is
 * not a valid hex digit.
 */
function parseHexPair(hi, lo) {
  const hiVal = hexDigitValue(hi);
  const loVal = hexDigitValue(lo);
  if (hiVal === null || loVal === null) {
    return null;
  }
  return hiVal * 16 + loVal;
}

/**
 * Map a single character to its hex value (0–15), or `null` if invalid.
 *
 * We avoid `parseInt(ch, 16)` here because it silently accepts whitespace
 * and partial prefixes (e.g. `parseInt(' ', 16)` is `NaN`, which we then
 * reject, but `parseInt('0x1', 16)` is `1` — not what we want for a single
 * digit). An explicit table is unambiguous.
 */
function hexDigitValue(ch) {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'F') return ch.charCodeAt(0) - 55;
  if (ch >= 'a' && ch <= 'f') return ch.charCodeAt(0) - 87;
  return null;
}
