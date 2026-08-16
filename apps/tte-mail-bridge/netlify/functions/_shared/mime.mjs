import { randomUUID } from 'node:crypto';

function cleanHeader(value) { return String(value || '').replace(/[\r\n]+/g, ' ').trim(); }
function encodedWord(value) { return `=?UTF-8?B?${Buffer.from(cleanHeader(value),'utf8').toString('base64')}?=`; }
export function buildMime({ fromName, fromEmail, to, subject, text, leadId, touchNo, idempotencyKey, inReplyTo, references }) {
  const domain = String(fromEmail).split('@')[1] || 'gmail.com';
  const messageId = `<tte-${randomUUID()}@${domain.replace(/[^a-z0-9.-]/gi,'')}>`;
  const headers = [
    `From: ${encodedWord(fromName || '222Emails')} <${cleanHeader(fromEmail)}>`,
    `To: <${cleanHeader(to)}>`,
    `Subject: ${encodedWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    `List-Unsubscribe: <mailto:${cleanHeader(fromEmail)}?subject=unsubscribe>`,
    `X-TTE-Lead-ID: ${cleanHeader(leadId)}`,
    `X-TTE-Touch-No: ${cleanHeader(touchNo)}`,
    `X-TTE-Idempotency-Key: ${cleanHeader(idempotencyKey)}`,
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${cleanHeader(inReplyTo)}`);
  if (references) headers.push(`References: ${cleanHeader(references)}`);
  const wire = `${headers.join('\r\n')}\r\n\r\n${String(text).replace(/\r?\n/g,'\r\n')}`;
  return { raw: Buffer.from(wire,'utf8').toString('base64url'), messageId };
}
