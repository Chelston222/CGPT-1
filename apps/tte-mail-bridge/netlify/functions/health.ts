import type { Config } from "@netlify/functions";

export default async () => {
  const configured = Boolean(Netlify.env.get("TTE_SMTP_PASS"));
  return new Response(JSON.stringify({
    service: "tte-mail-bridge",
    sender: Netlify.env.get("TTE_SMTP_USER") || "hello@222emails.com",
    smtpHost: Netlify.env.get("TTE_SMTP_HOST") || "mail.privateemail.com",
    dailyCap: Number(Netlify.env.get("TTE_DIRECT_DAILY_CAP") || "20"),
    smtpConfigured: configured,
  }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};

export const config: Config = {
  path: "/api/tte/health",
  method: ["GET"],
};
