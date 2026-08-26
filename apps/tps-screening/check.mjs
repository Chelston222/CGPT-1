const PROVIDERS = {
  tpscheck: {
    enabled: Boolean(process.env.TPSCHECK_API_KEY),
    async check(phone) {
      const res = await fetch('https://api.tpscheck.uk/check?version=2', {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.TPSCHECK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(`TPSCheck.uk ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return {
        provider: 'TPSCheck.uk',
        phone: body.e164 || body.input || phone,
        valid: body.valid !== false,
        tps: Boolean(body.tps),
        ctps: Boolean(body.ctps),
        checked_at: new Date().toISOString(),
        raw: body
      };
    },
    async credits() {
      const res = await fetch('https://api.tpscheck.uk/credits', {
        headers: { Authorization: `Token ${process.env.TPSCHECK_API_KEY}` }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`TPSCheck.uk credits ${res.status}`);
      return body;
    }
  }
};

export async function screenPhone(phone, preferredProvider = 'tpscheck') {
  const provider = PROVIDERS[preferredProvider];
  if (!provider) throw new Error(`Unknown provider: ${preferredProvider}`);
  if (!provider.enabled) throw new Error(`${preferredProvider} is not configured`);
  return provider.check(phone);
}

export async function providerStatus() {
  const status = {};
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    status[name] = { enabled: provider.enabled };
    if (provider.enabled && provider.credits) {
      try { status[name].credits = await provider.credits(); }
      catch (error) { status[name].credits_error = error.message; }
    }
  }
  status.tpschecker = {
    enabled: false,
    reason: 'Secondary provider intentionally disabled until API credentials and free/trial allowance are confirmed.'
  };
  return status;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [phone] = process.argv.slice(2);
  if (!phone) {
    console.error('Usage: node check.mjs <UK phone number>');
    process.exit(2);
  }
  try {
    const result = await screenPhone(phone);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message, status: error.status, body: error.body }, null, 2));
    process.exit(1);
  }
}
