import { describe, it, expect } from "vitest";
import { buildApp } from "../src/index.js";

describe("health route", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe("ok");
  });
});
