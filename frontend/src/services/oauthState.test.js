import { describe, expect, it } from "vitest";
import { consumeOAuthState, createOAuthState } from "./oauthState.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("GitHub OAuth state", () => {
  it("accepts the matching callback once", () => {
    const storage = memoryStorage();
    const state = createOAuthState(storage, { randomUUID: () => "trusted-state" });
    expect(state).toBe("trusted-state");
    expect(consumeOAuthState("trusted-state", storage)).toBe(true);
    expect(consumeOAuthState("trusted-state", storage)).toBe(false);
  });

  it("rejects a callback with a different state", () => {
    const storage = memoryStorage();
    createOAuthState(storage, { randomUUID: () => "expected" });
    expect(consumeOAuthState("attacker-state", storage)).toBe(false);
  });
});
