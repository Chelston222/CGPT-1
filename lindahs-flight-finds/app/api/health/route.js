import { getLaunchStatus } from '../../../lib/launch.js';

export async function GET() {
  const status = getLaunchStatus();

  return Response.json({
    ok: true,
    service: "lindahs-flight-finds",
    time: new Date().toISOString(),
    audienceReady: status.audienceReady,
    blockers: status.blockers.map((item) => item.label)
  });
}
