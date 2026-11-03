const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isGameWebUrl, WEB_ORIGIN, WEB_ORIGIN_WHITELIST } = require('../src/config.ts');

test('WebView receives an origin allowlist without a path suffix', () => {
  assert.deepEqual(WEB_ORIGIN_WHITELIST, [WEB_ORIGIN]);
  for (const path of ['', '/', '/games/liars-deck', '/lobby/123456', '/games/liars-dice/play/123456?view=table#hand']) {
    const origin = new URL(`${WEB_ORIGIN}${path}`).origin;
    assert(WEB_ORIGIN_WHITELIST.includes(origin));
    assert(isGameWebUrl(`${WEB_ORIGIN}${path}`));
  }
});

for (const [label, url] of [
  ['lookalike host', `${WEB_ORIGIN}.example.com/games`],
  ['userinfo lookalike', `${WEB_ORIGIN}@example.com/games`],
  ['subdomain', WEB_ORIGIN.replace('://', '://other.')],
  ['different port', `${WEB_ORIGIN}:444/games`],
  ['HTTP downgrade', WEB_ORIGIN.replace('https://', 'http://')],
  ['external origin', 'https://example.com/games'],
  ['script URL', 'javascript:void(0)'],
  ['blank document', 'about:blank'],
  ['malformed URL', 'not a URL'],
  ['missing URL', undefined],
]) {
  test(`navigation and native messages reject ${label}`, () => {
    assert.equal(isGameWebUrl(url), false);
  });
}
