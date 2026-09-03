import type { Config } from '@netlify/functions';
import { configStatus } from './_shared/auth.mjs';
import { VERSION } from './_shared/constants.mjs';
import { jsonResponse } from './_shared/util.mjs';

export default async () => {
  const configured = configStatus();
  const oauthConfigured = configured.googleOAuthClientId && configured.googleOAuthClientSecret;
  const smtpConfigured = Boolean(Netlify.env.get('TTE_SMTP_PASS'));
  const coreConfigured = configured.bridgeToken && configured.encryptionKey && configured.keysDistinct;
  const transportConfigured = Boolean(oauthConfigured || smtpConfigured);
  const mode = oauthConfigured && smtpConfigured ? 'GMAIL_SMTP' : oauthConfigured ? 'GMAIL' : smtpConfigured ? 'SMTP' : 'NONE';

  return jsonResponse(200, {
    service:'tte-mail-bridge',
    version:VERSION,
    status:coreConfigured && transportConfigured ? 'READY' : 'CONFIG_REQUIRED',
    mode,
    transportConfigured,
    oauthConfigured:Boolean(oauthConfigured),
    smtpConfigured,
    encryptionConfigured:configured.encryptionKey,
  });
};
export const config: Config = { path:'/api/tte/health', method:['GET'] };
