import type { Config } from '@netlify/functions';
import { configStatus } from './_shared/auth.mjs';
import { VERSION } from './_shared/constants.mjs';
import { jsonResponse } from './_shared/util.mjs';

export default async () => {
  const configured = configStatus();
  return jsonResponse(200, {
    service:'tte-mail-bridge',
    version:VERSION,
    status:Object.values(configured).every(Boolean) ? 'READY' : 'CONFIG_REQUIRED',
    oauthConfigured:configured.googleOAuthClientId && configured.googleOAuthClientSecret,
    encryptionConfigured:configured.encryptionKey,
  });
};
export const config: Config = { path:'/api/tte/health', method:['GET'] };
