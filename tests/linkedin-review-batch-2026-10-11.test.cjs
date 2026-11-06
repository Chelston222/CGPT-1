const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '../apps/linkedin-review/review-batches/2026-10-11');
const batch = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
test('all 15 unique public copy drafts remain unapproved and unscheduled', () => {
  assert.equal(batch.posts.length, 15);
  assert.deepEqual(batch.posts.map(p => p.id), ['M1','M2','M3','M4','M5','M6','S1','S2','S3','S4','S5','S6','P1','P2','P3']);
  for (const item of [batch, ...batch.posts]) {
    assert.equal(item.status, 'draft'); assert.equal(item.qaStatus, 'awaiting_qa');
    assert.equal(item.publishing, false); assert.equal(item.approvalEligible, false);
    for (const key of Object.keys(item)) assert.ok(!/scheduled|publishAt|approvedAt|analytics|sourceNotes|credentials/i.test(key));
  }
  for (const post of batch.posts) {
    assert.ok(post.caption.length > 100);
    assert.equal(post.account, {M:'@222emails',S:'@222-emails',P:'@chelstonspeaks'}[post.id[0]]);
    assert.deepEqual(Object.keys(post).sort(), ['id','title','account','caption','status','qaStatus','publishing','approvalEligible','assets'].sort());
  }
});
test('every asset link resolves to exact verified bytes; 11 PNGs and 2 PDFs', () => {
  const assets = batch.posts.flatMap(p => p.assets);
  assert.equal(assets.length, 13); assert.equal(new Set(assets.map(a => a.path)).size, 13);
  assert.equal(assets.filter(a => a.path.endsWith('.png')).length, 11);
  assert.equal(assets.filter(a => a.path.endsWith('.pdf')).length, 2);
  for (const asset of assets) {
    assert.match(asset.path, /^assets\/(M5|P2|P3|S1)\/[\w-]+\.(png|pdf)$/);
    const bytes = fs.readFileSync(path.join(root, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (asset.path.endsWith('.png')) {
      assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), 2160); assert.equal(bytes.readUInt32BE(20), 2700);
    } else assert.equal(bytes.subarray(0,5).toString(), '%PDF-');
  }
});
