import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { encode, decode } from '../src/index.js';

describe('encode', () => {
  it('leaves the unreserved set untouched', () => {
    assert.equal(encode('AZaz09-_.~'), 'AZaz09-_.~');
  });

  it('escapes a single reserved character', () => {
    assert.equal(encode(' '), '%20');
  });

  it('escapes every non-unreserved byte', () => {
    assert.equal(encode('a/b:c@d'), 'a%2Fb%3Ac%40d');
  });

  it('uppercases the hex digits in escapes', () => {
    assert.equal(encode('\u00f6'), '%C3%B6'); // German lowercase o-umlaut
  });

  it('encodes the empty string', () => {
    assert.equal(encode(''), '');
  });

  it('encodes astral characters as their full UTF-8 byte sequence', () => {
    // U+1F600 (grinning face emoji) → F0 9F 98 80 in UTF-8.
    assert.equal(encode('\u{1F600}'), '%F0%9F%98%80');
  });

  it('encodes a literal percent sign as %25', () => {
    assert.equal(encode('100%'), '100%25');
  });

  it('throws TypeError for non-string input', () => {
    assert.throws(() => encode(42), TypeError);
    assert.throws(() => encode(null), TypeError);
  });
});

describe('decode', () => {
  it('decodes the empty string', () => {
    assert.equal(decode(''), '');
  });

  it('leaves unreserved characters untouched', () => {
    assert.equal(decode('AZaz09-_.~'), 'AZaz09-_.~');
  });

  it('decodes an uppercase percent escape', () => {
    assert.equal(decode('%20'), ' ');
  });

  it('decodes a lowercase percent escape', () => {
    assert.equal(decode('%c3%b6'), '\u00f6');
  });

  it('round-trips an astral character', () => {
    const original = 'snowman \u{2603} and grinning \u{1F600}';
    assert.equal(decode(encode(original)), original);
  });

  it('decodes a literal percent sign that was double-encoded', () => {
    assert.equal(decode('100%25'), '100%');
  });

  it('throws URIError on a truncated escape', () => {
    assert.throws(() => decode('%2'), URIError);
  });

  it('throws URIError on a non-hex digit in an escape', () => {
    assert.throws(() => decode('%ZZ'), URIError);
  });

  it('throws URIError on bytes that form invalid UTF-8', () => {
    // 0xFF is not a valid UTF-8 lead byte.
    assert.throws(() => decode('%FF'), URIError);
  });

  it('throws TypeError for non-string input', () => {
    assert.throws(() => decode(undefined), TypeError);
  });
});

describe('round-trip', () => {
  it('preserves a mixed string of ASCII, Latin-1, and CJK', () => {
    const original = 'Hello, 世界! café 100% pure';
    assert.equal(decode(encode(original)), original);
  });
});
