import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("error_rate");
const searchDuration = new Trend("search_duration");
const homeDuration = new Trend("home_duration");

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "2m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    "http_req_duration{endpoint:home}": ["p95<1000"],
    "http_req_duration{endpoint:search}": ["p95<2000"],
    http_req_failed: ["rate<0.01"],
    error_rate: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

const SEARCH_QUERIES = [
  "arijit singh",
  "lo-fi beats",
  "ap dhillon",
  "bollywood hits",
  "punjabi songs",
  "taylor swift",
];

export default function () {
  const homeRes = http.get(`${BASE_URL}/api/homepage`, {
    tags: { endpoint: "home" },
  });
  check(homeRes, {
    "home: status 200": (r) => r.status === 200,
    "home: response < 2s": (r) => r.timings.duration < 2000,
  });
  homeDuration.add(homeRes.timings.duration);
  errorRate.add(homeRes.status !== 200);

  sleep(0.5);

  const query =
    SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const searchRes = http.get(
    `${BASE_URL}/api/search?q=${encodeURIComponent(query)}`,
    { tags: { endpoint: "search" } }
  );
  check(searchRes, {
    "search: status 200": (r) => r.status === 200,
    "search: has results": (r) => {
      try {
        return JSON.parse(r.body).results?.length > 0;
      } catch {
        return false;
      }
    },
    "search: response < 3s": (r) => r.timings.duration < 3000,
  });
  searchDuration.add(searchRes.timings.duration);
  errorRate.add(searchRes.status !== 200);

  sleep(1);

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health: status 200": (r) => r.status === 200,
    "health: response < 200ms": (r) => r.timings.duration < 200,
    "health: is healthy": (r) => {
      try {
        return JSON.parse(r.body).status === "healthy";
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
