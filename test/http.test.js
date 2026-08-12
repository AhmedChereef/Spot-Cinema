import test from "node:test";
import assert from "node:assert/strict";
import { requestWithRetry } from "../src/lib/http.js";

const noWait = async (waits, ms) => {
  waits.push(ms);
};

test("retries temporary gateway errors and returns the successful response", async () => {
  let calls = 0;
  const waits = [];
  const response = await requestWithRetry("https://elcinema.com/en/now/", {}, {
    fetchFn: async () => {
      calls += 1;
      return calls < 3
        ? new Response("temporary", { status: 502 })
        : new Response("ok", { status: 200 });
    },
    maxAttempts: 5,
    baseDelayMs: 10,
    timeoutMs: 1_000,
    sleep: (ms) => noWait(waits, ms),
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [10, 20]);
  assert.equal(await response.text(), "ok");
});

test("stops after five unsuccessful temporary responses", async () => {
  let calls = 0;
  const waits = [];

  await assert.rejects(
    requestWithRetry("https://elcinema.com/en/now/", {}, {
      fetchFn: async () => {
        calls += 1;
        return new Response("unavailable", { status: 503 });
      },
      maxAttempts: 5,
      baseDelayMs: 10,
      timeoutMs: 1_000,
      sleep: (ms) => noWait(waits, ms),
    }),
    (error) => {
      assert.equal(error.details.upstreamStatus, 503);
      assert.equal(error.details.attempts, 5);
      return true;
    },
  );

  assert.equal(calls, 5);
  assert.deepEqual(waits, [10, 20, 40, 80]);
});

test("does not retry a non-transient HTTP error", async () => {
  let calls = 0;

  await assert.rejects(
    requestWithRetry("https://elcinema.com/en/now/", {}, {
      fetchFn: async () => {
        calls += 1;
        return new Response("missing", { status: 404 });
      },
      maxAttempts: 5,
      baseDelayMs: 10,
      timeoutMs: 1_000,
      sleep: async () => assert.fail("404 must not be retried"),
    }),
    (error) => {
      assert.equal(error.details.upstreamStatus, 404);
      assert.equal(error.details.attempts, 1);
      return true;
    },
  );

  assert.equal(calls, 1);
});
