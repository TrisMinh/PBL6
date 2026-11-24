import { setTimeout } from "node:timers/promises";

const [target, rawWorkers = "300", rawSeconds = "60", availabilityTarget] = process.argv.slice(2);
const base = new URL(target);
const availabilityBase = availabilityTarget ? new URL(availabilityTarget) : undefined;
const isLoopback = (url) => url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port;
const workers = Number(rawWorkers);
const seconds = Number(rawSeconds);
if (!isLoopback(base) || (availabilityBase && !isLoopback(availabilityBase)) ||
    !Number.isInteger(workers) || workers < 1 || workers > 300 ||
    !Number.isInteger(seconds) || seconds < 1 || seconds > 600) {
  throw new Error("Usage: node benchmark-search.mjs http://127.0.0.1:<isolated-transport-port> [users:1-300] [seconds:1-600] [http://127.0.0.1:<isolated-booking-port>]");
}

const search = "/api/v1/trips?passengerCount=1&size=20";
const sample = await fetch(new URL(search, base), { signal: AbortSignal.timeout(10000) });
if (!sample.ok) throw new Error("Search warm-up returned HTTP " + sample.status);
const { items, totalElements } = await sample.json();
if (!items.length) throw new Error("The isolated database has no sellable trips.");

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
});
const searchCases = [
  { name: "broad", path: search },
  { name: "price", path: search + "&sort=PRICE_ASC" },
  { name: "deep", path: search + "&page=10" },
  ...items.slice(0, 5).map((trip) => ({
    name: "route-and-date",
    path: search + "&" + new URLSearchParams({
      origin: trip.origin,
      destination: trip.destination,
      departureDate: date.format(new Date(trip.departureAt)),
    }),
  })),
  ...items.slice(0, 3).map((trip) => ({ name: "detail", path: "/api/v1/trips/" + trip.id })),
];
const cases = availabilityBase
  ? items.slice(0, 5).map((_, index) => ({
      name: "availability",
      url: new URL("/api/v1/trips/availability?" + new URLSearchParams({
        ids: items.slice(index, index + 12).map(({ id }) => id).join(","),
      }), availabilityBase),
    }))
  : searchCases;
const metrics = new Map([...new Set(cases.map(({ name }) => name))].map((name) => [name, { times: [], errors: {} }]));

async function hit(scenario, record) {
  const start = performance.now();
  let error;
  try {
    const response = await fetch(scenario.url ?? new URL(scenario.path, base), { signal: AbortSignal.timeout(10000) });
    await response.arrayBuffer();
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (exception) {
    error = exception.name;
  }
  if (!record) return;
  const metric = metrics.get(scenario.name);
  metric.times.push(performance.now() - start);
  if (error) metric.errors[error] = (metric.errors[error] ?? 0) + 1;
}

await Promise.all(cases.map((scenario) => hit(scenario, false)));
const started = performance.now();
const end = started + seconds * 1000;
await Promise.all(Array.from({ length: workers }, async (_, user) => {
  await setTimeout(user % 250);
  let index = user;
  while (performance.now() < end) {
    await hit(cases[index % cases.length], true);
    index++;
  }
}));

function summarize(times, errors) {
  const sorted = times.sort((a, b) => a - b);
  const percentile = (p) => Math.round(sorted[Math.ceil(sorted.length * p) - 1] ?? 0);
  return { requests: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), errors };
}

const byScenario = Object.fromEntries([...metrics].map(([name, metric]) => [name, summarize(metric.times, metric.errors)]));
const searches = [...metrics].filter(([name]) => name !== "detail" && name !== "availability").map(([, metric]) => metric);
const searchErrors = searches.reduce((total, metric) => total + Object.values(metric.errors).reduce((sum, count) => sum + count, 0), 0);
const searchSummary = summarize(searches.flatMap((metric) => metric.times), searchErrors);
console.log(JSON.stringify({ workers, seconds, measuredElapsedMs: Math.round(performance.now() - started),
  eligibleTrips: totalElements, ...(availabilityBase ? {} : { search: searchSummary }), byScenario }, null, 2));
const detail = byScenario.detail ?? byScenario.availability;
if (searchErrors || searchSummary.p95Ms > 2000 || searchSummary.p99Ms > 4000 ||
    Object.keys(detail.errors).length || detail.p95Ms > 1500) process.exitCode = 1;
