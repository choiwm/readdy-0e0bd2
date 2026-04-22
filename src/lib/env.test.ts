import { describe, it, expect, beforeEach } from "vitest";
import { getAuthorizationHeader, SUPABASE_ANON_KEY } from "./env";

describe("getAuthorizationHeader", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the anon key when no session is present", () => {
    expect(getAuthorizationHeader()).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
  });

  it("prefers the primary 'sb-session' key", () => {
    localStorage.setItem("sb-session", JSON.stringify({ access_token: "primary-token" }));
    expect(getAuthorizationHeader()).toBe("Bearer primary-token");
  });

  it("falls back to any sb-*-auth key", () => {
    localStorage.setItem("sb-project-auth-token", JSON.stringify({ access_token: "fallback-token" }));
    expect(getAuthorizationHeader()).toBe("Bearer fallback-token");
  });

  it("ignores malformed JSON in auth keys", () => {
    localStorage.setItem("sb-broken-auth", "not-json");
    localStorage.setItem("sb-good-auth", JSON.stringify({ access_token: "recovered" }));
    expect(getAuthorizationHeader()).toBe("Bearer recovered");
  });

  it("still returns anon key when session JSON has no access_token", () => {
    localStorage.setItem("sb-session", JSON.stringify({ other: "field" }));
    expect(getAuthorizationHeader()).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
  });
});
