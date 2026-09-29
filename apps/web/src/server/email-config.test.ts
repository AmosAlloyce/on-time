import { afterEach, describe, expect, it, vi } from "vitest";
import { systemEmailIdentity } from "./email-config";

describe("system email identity", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("canonicalizes one approved sender address", () => {
    vi.stubEnv("EMAIL_FROM", "On-Time <notifications@ontime.com>");
    vi.stubEnv("EMAIL_REPLY_TO", "support@ontime.com");
    vi.stubEnv("EMAIL_SENDER_DOMAIN", "ontime.com");
    expect(systemEmailIdentity()).toEqual({ from: "On-Time <notifications@ontime.com>", fromMailbox: "notifications@ontime.com", replyTo: "support@ontime.com", senderDomain: "ontime.com" });
  });

  it.each([
    "attacker@example.net, On-Time <notifications@ontime.com>",
    '"Attacker" <attacker@example.net>, On-Time <notifications@ontime.com>',
    "On-Time <notifications@ontime.com>, attacker@example.net",
  ])("rejects multiple or injected From identities: %s", (from) => {
    vi.stubEnv("EMAIL_FROM", from);
    vi.stubEnv("EMAIL_REPLY_TO", "support@ontime.com");
    vi.stubEnv("EMAIL_SENDER_DOMAIN", "ontime.com");
    expect(() => systemEmailIdentity()).toThrow("SMTP_MAILBOX_INVALID");
  });
});
