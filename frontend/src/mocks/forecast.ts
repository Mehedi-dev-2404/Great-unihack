import type { Forecast } from "@/lib/types";

/** Mock 12-month forecast in the same shape the live API is adapted to. */
export function buildForecast(): Forecast {
  const current = 976.48;
  const flow = -19.43;
  const uplift = 400.17;
  const start = new Date(Date.UTC(2026, 11, 1));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const month = d.toISOString().slice(0, 7);
    return {
      month,
      baseline: Math.round((current + flow * (i + 1)) * 100) / 100,
      with_fola: Math.round((current + (flow + uplift) * (i + 1)) * 100) / 100,
    };
  });
  return {
    current,
    months,
    monthly_uplift: uplift,
    assumptions: [
      "Your money in and out over the last 3 months carries on unchanged.",
      "Universal Credit child amount for your third child adds about £303.94 a month.",
      "Cancelling YouTube Music saves £10.99 a month.",
      "Figures are estimates, not advice.",
    ],
  };
}
