import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 200 },
    { duration: "30s", target: 200 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export default function () {
  const res = http.get(
    `${BASE_URL}/api/search?q=unique+query+${Math.random()}`
  );

  check(res, {
    "no 500 errors": (r) => r.status !== 500,
    "no server crash": (r) => r.status < 500,
    "quota handled gracefully": (r) =>
      r.status === 200 || r.status === 429,
  });

  if (res.status === 429) {
    check(res, {
      "quota error has message": (r) => {
        try {
          return JSON.parse(r.body).message !== undefined;
        } catch {
          return false;
        }
      },
    });
  }

  sleep(0.1);
}
