function boolText(value) {
  return String(value).toLowerCase() === 'true';
}

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
  },
  tpschecker: {
    enabled: Boolean(process.env.TPSCHECKER_EMAIL && process.env.TPSCHECKER_PASSWORD),
    async check(phone) {
      const form = new URLSearchParams({
        email: process.env.TPSCHECKER_EMAIL,
        password: process.env.TPSCHECKER_PASSWORD,
        number: phone,
        list: 'TPS,CTPS',
        privacy: 'false',
        format: 'json'
      });
      const res = await fetch('https://www.tpschecker.co.uk/api/check-number.aspx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(`TPSChecker ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      const check = body.CheckNumber || {};
      const lists = Array.isArray(check.ResultDetailed?.List)
        ? check.ResultDetailed.List
        : (check.ResultDetailed?.List ? [check.ResultDetailed.List] : []);
      const byName = Object.fromEntries(lists.map(x => [String(x['@Name'] || '').toUpperCase(), boolText(x['#text'])]));
      return {
        provider: 'TPSChecker',
        phone: check.Number || phone,
        valid: Boolean(check.Number),
        tps: Boolean(byName.TPS),
        ctps: Boolean(byName.CTPS),
        checked_at: new Date().toISOString(),
        credits_remaining: Number(check.ChecksRemaining || 0),
        raw: body
      };
    },
    async credits() {
      const form = new URLSearchParams({
        email: process.env.TPSCHECKER_EMAIL,
        password: process.env.TPSCHECKER_PASSWORD,
        format: 'json'
      });
      const res = await fetch('https://www.tpschecker.co.uk/api/check-balance.aspx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`TPSChecker balance ${res.status}`);
      const balance = body.CheckBalance || {};
      return {
        requests_remaining: Number(balance.ChecksRemaining || 0),
        free_checks_today: Number(balance.ChecksRemainingDetailed?.FreeChecksToday || 0),
        paid_checks: Number(balance.ChecksRemainingDetailed?.PaidChecks || 0)
      };
    }
  }
};

export async function screenPhone(phone, preferredProvider = 'tpschecker') {
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
  return status;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [phone, provider = 'tpschecker'] = process.argv.slice(2);
  if (!phone) {
    console.error('Usage: node check.mjs <UK phone number> [tpschecker|tpscheck]');
    process.exit(2);
  }
  try {
    const result = await screenPhone(phone, provider);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message, status: error.status, body: error.body }, null, 2));
    process.exit(1);
  }
}
