import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate=0"],
    http_req_duration: ["p99<5000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const endpoints = [
    { url: "/health", name: "health" },
    { url: "/api/homepage", name: "homepage" },
    { url: "/api/search?q=test", name: "search" },
    {
      url: "/api/recommendations/time-aware?slot=morning",
      name: "time-recs",
    },
    { url: "/api/mixes/daily", name: "daily-mixes" },
    { url: "/api/search/trending", name: "trending" },
  ];

  for (const ep of endpoints) {
    const res = http.get(BASE + ep.url, { tags: { name: ep.name } });
    check(res, {
      [`${ep.name}: status ok`]: (r) => r.status === 200,
      [`${ep.name}: not empty`]: (r) => r.body.length > 10,
      [`${ep.name}: < 5s`]: (r) => r.timings.duration < 5000,
    });
  }
}
