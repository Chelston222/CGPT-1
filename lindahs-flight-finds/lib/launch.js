const PLACEHOLDER_CONTACTS = new Set([
  '',
  'contact email pending',
  'hello@lindahsflightfinds.com'
]);

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasResendSetup() {
  return hasValue(process.env.RESEND_API_KEY) &&
    (hasValue(process.env.RESEND_AUDIENCE_ID) || hasValue(process.env.RESEND_TOPIC_ID));
}

function hasWebhookSetup() {
  return hasValue(process.env.WAITLIST_WEBHOOK_URL);
}

export function getLaunchStatus() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';
  const audienceRegion = process.env.NEXT_PUBLIC_BRAND_REGION || 'UK';
  const alertProviderReady = hasResendSetup() || hasWebhookSetup();
  const analyticsReady = hasValue(process.env.TRACK_EVENTS_WEBHOOK_URL);
  const affiliateReady = hasValue(process.env.AFFILIATE_NETWORK_ID);

  const checks = [
    {
      id: 'site-url',
      label: 'Production site URL configured',
      pass: hasValue(siteUrl),
      detail: hasValue(siteUrl) ? siteUrl : 'Set NEXT_PUBLIC_SITE_URL in Vercel.'
    },
    {
      id: 'contact-email',
      label: 'Public contact email configured',
      pass: hasValue(contactEmail) && !PLACEHOLDER_CONTACTS.has(contactEmail),
      detail: hasValue(contactEmail) ? contactEmail : 'Set NEXT_PUBLIC_CONTACT_EMAIL.'
    },
    {
      id: 'alerts-provider',
      label: 'Deal alerts backend configured',
      pass: alertProviderReady,
      detail: alertProviderReady
        ? hasResendSetup() ? 'Resend credentials detected.' : 'Webhook signup destination detected.'
        : 'Add Resend credentials or WAITLIST_WEBHOOK_URL.'
    },
    {
      id: 'analytics',
      label: 'Event forwarding configured',
      pass: analyticsReady,
      detail: analyticsReady ? 'Tracking webhook configured.' : 'Optional: add TRACK_EVENTS_WEBHOOK_URL for event forwarding.'
    },
    {
      id: 'affiliate',
      label: 'Affiliate or referral setup configured',
      pass: affiliateReady,
      detail: affiliateReady ? 'Affiliate network identifier detected.' : 'Add AFFILIATE_NETWORK_ID when referral partnerships are approved.'
    },
    {
      id: 'region',
      label: 'Audience region set',
      pass: hasValue(audienceRegion),
      detail: audienceRegion || 'Set NEXT_PUBLIC_BRAND_REGION.'
    }
  ];

  const blockers = checks.filter((check) =>
    ['site-url', 'contact-email', 'alerts-provider'].includes(check.id) && !check.pass
  );

  return {
    checks,
    blockers,
    audienceReady: blockers.length === 0,
    audienceRegion
  };
}
