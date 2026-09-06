'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'linkedin-imap-pdf-intake.mjs'), 'utf8');

test('IMAP attachment selection trusts exact locked bytes and PDF signature rather than a fragile MIME label', () => {
  assert.match(source, /item\.filename === expectedFilename && item\.content\?\.length/);
  assert.doesNotMatch(source, /item\.contentType === ['"]application\/pdf['"]/);
  assert.match(source, /candidate\.length !== expectedBytes/);
  assert.match(source, /candidate\.subarray\(0, 5\)\.toString\('ascii'\) !== '%PDF-'/);
  assert.match(source, /candidateSha256 !== expectedSha256/);
});
