# percent-encoding

Encodes and decodes arbitrary strings into a URL-safe format using byte-level
percent escapes. UTF-8 is the fixed character encoding; the unreserved set is
`A–Z`, `a–z`, `0–9`, and `-_.~`.

```js
import { encode, decode } from 'percent-encoding';

encode('Hello, 世界! 100%');  // 'Hello%2C%20%E4%B8%96%E7%95%8C%21%20100%25'
decode('Hello%2C%20%E4%B8%96%E7%95%8C%21%20100%25');  // 'Hello, 世界! 100%'
```

## Why this exists

`encodeURIComponent` and `decodeURIComponent` are built into every JavaScript
environment, but they encode the *unreserved set* inconsistently across
engines and leave characters like `!`, `*`, `(`, `)` unescaped on some platforms.
That makes their output unsuitable as a stable, byte-identical transport
format. This library picks the strict RFC 3986 unreserved set (`A–Z`, `a–z`,
`0–9`, `-_.~`) and escapes everything else, so the output is identical
wherever it runs.

The trade-off: the output is more verbose than `encodeURIComponent` would
produce, because characters like `/` and `:` are escaped even in contexts
that would accept them raw. That is the point — the encoded form is meant to
be safe to drop into *any* component of a URL without thinking about which
characters are special where.

## Awkward edges

- **Astral characters** (U+10000 and above) are encoded as their full UTF-8
  byte sequence, not as two surrogate-pair escapes. `decode` reassembles the
  UTF-8 bytes, so `decode(encode('\u{1F600}'))` round-trips correctly.
- **Malformed input** to `decode` is rejected with a `URIError`, not silently
  repaired. This includes truncated escapes (`%2`), non-hex digits (`%ZZ`),
  and byte sequences that are not valid UTF-8 (`%FF`).
- `decode` accepts lowercase hex digits even though `encode` always emits
  uppercase, matching RFC 3986 §2.1.
