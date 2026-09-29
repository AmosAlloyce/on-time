import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const envFile = join(rootDir, "provider.env");
const secretsDir = join(rootDir, "secrets");

if (!existsSync(envFile)) {
  console.error("Error: provider.env not found. Please create provider.env with your provider credentials.");
  process.exit(1);
}

const content = readFileSync(envFile, "utf8");
const parsed = {};
for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    parsed[match[1]] = val;
  }
}

// 1. Move secret values to secrets/
const secretMap = {
  GOOGLE_CLIENT_SECRET: "google_client_secret",
  STRIPE_SECRET_KEY: "stripe_secret_key",
  STRIPE_WEBHOOK_SECRET: "stripe_webhook_secret",
  SMTP_PASSWORD: "smtp_password",
};

for (const [envVar, secretName] of Object.entries(secretMap)) {
  if (parsed[envVar]) {
    const secretPath = join(secretsDir, secretName);
    writeFileSync(secretPath, parsed[envVar].trim() + "\n", { mode: 0o600 });
    console.log(`Updated secret: ${secretName}`);
  }
}

// 2. Generate .env for docker compose (non-secret environment variables)
const buildId = parsed.BUILD_ID || "1f4d5c6f649ee5b676d46eb45dbfb06233c30da2";
const appUrl = parsed.NEXT_PUBLIC_APP_URL || "https://ontime.alloyce.duckdns.org";

const composeEnv = `# Auto-generated production environment
BUILD_ID=${buildId}
NEXT_PUBLIC_APP_URL=${appUrl}
BOOKING_CAPABILITY_KEY_ID=ontime-cap-v1

GOOGLE_CLIENT_ID=${parsed.GOOGLE_CLIENT_ID || ""}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${parsed.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}

SMTP_HOST=${parsed.SMTP_HOST || "smtp.gmail.com"}
SMTP_PORT=${parsed.SMTP_PORT || "587"}
SMTP_TLS_MODE=${parsed.SMTP_TLS_MODE || "starttls"}
SMTP_USER=${parsed.SMTP_USER || ""}
EMAIL_FROM=${parsed.EMAIL_FROM || ""}
EMAIL_REPLY_TO=${parsed.EMAIL_REPLY_TO || ""}
EMAIL_SENDER_DOMAIN=${parsed.EMAIL_SENDER_DOMAIN || ""}
`;

writeFileSync(join(rootDir, ".env"), composeEnv, { mode: 0o600 });
console.log("Updated .env for Docker Compose");

// 3. Remove raw provider.env for security
unlinkSync(envFile);
console.log("Securely removed provider.env");
