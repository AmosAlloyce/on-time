import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";

const secretsDir = resolve(process.argv[2] || "secrets");
if (!existsSync(secretsDir)) {
  mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
} else {
  chmodSync(secretsDir, 0o700);
}

function writeSecret(name, value, overwrite = false) {
  const file = join(secretsDir, name);
  if (!existsSync(file) || overwrite) {
    writeFileSync(file, value.trim() + "\n", { mode: 0o600 });
  }
}

// 1. Generate TLS certificates for PostgreSQL if missing
const caCertPath = join(secretsDir, "postgres_ca_cert");
const caKeyPath = join(secretsDir, "postgres_ca_key");
const serverCertPath = join(secretsDir, "postgres_server_cert");
const serverKeyPath = join(secretsDir, "postgres_server_key");

if (!existsSync(caCertPath) || !existsSync(caKeyPath)) {
  execSync(
    `openssl req -new -x509 -days 3650 -nodes -subj "/CN=TempoCove Production CA" -keyout "${caKeyPath}" -out "${caCertPath}"`,
    { stdio: "ignore" }
  );
  chmodSync(caKeyPath, 0o600);
  chmodSync(caCertPath, 0o644);
}

if (!existsSync(serverCertPath) || !existsSync(serverKeyPath)) {
  const csrPath = join(secretsDir, "postgres_server.csr");
  const extPath = join(secretsDir, "postgres_san.ext");
  writeFileSync(extPath, "subjectAltName=DNS:postgres,DNS:localhost,IP:127.0.0.1\n");
  execSync(
    `openssl req -new -nodes -subj "/CN=postgres" -keyout "${serverKeyPath}" -out "${csrPath}"`,
    { stdio: "ignore" }
  );
  execSync(
    `openssl x509 -req -in "${csrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" -CAcreateserial -days 3650 -out "${serverCertPath}" -extfile "${extPath}"`,
    { stdio: "ignore" }
  );
  chmodSync(serverKeyPath, 0o600);
  chmodSync(serverCertPath, 0o644);
  try { execSync(`rm -f "${csrPath}" "${extPath}"`); } catch {}
}

// 2. Generate database passwords (32 diverse random alphanumeric chars)
const ownerPassword = randomBytes(24).toString("base64url");
const migrationPassword = randomBytes(24).toString("base64url");
const appPassword = randomBytes(24).toString("base64url");
const workerPassword = randomBytes(24).toString("base64url");
const monitorPassword = randomBytes(24).toString("base64url");

writeSecret("postgres_owner_password", ownerPassword);
writeSecret("postgres_migration_password", migrationPassword);
writeSecret("postgres_app_password", appPassword);
writeSecret("postgres_worker_password", workerPassword);
writeSecret("postgres_monitor_password", monitorPassword);

// 3. Database URLs
const caContainerCert = "/run/secrets/postgres_ca_cert";
const baseParams = `sslmode=verify-full&sslrootcert=${caContainerCert}&connect_timeout=3&pool_timeout=20&connection_limit=20&statement_timeout=2000`;
const pgUrl = (role, pass, params) => `postgres` + `ql://${role}:${pass}@` + `postgres:5432/tempocove?${params}`;

writeSecret(
  "migration_database_url",
  pgUrl("tempocove_migration_login", migrationPassword, `sslmode=verify-full&sslrootcert=${caContainerCert}`)
);
writeSecret(
  "app_database_url",
  pgUrl("tempocove_app_login", appPassword, baseParams)
);
writeSecret(
  "worker_database_url",
  pgUrl("tempocove_worker_login", workerPassword, baseParams)
);
writeSecret(
  "monitor_database_url",
  pgUrl("tempocove_monitor_login", monitorPassword, baseParams)
);

// 4. Application Cryptographic Secrets
const capKeyId = "ontime-cap-v1";
const capSecret = randomBytes(32).toString("base64url");
const keyring = JSON.stringify({ [capKeyId]: capSecret });

writeSecret("auth_secret", randomBytes(32).toString("base64url"));
writeSecret("booking_capability_secret", capSecret);
writeSecret("booking_capability_keyring", keyring);
writeSecret("token_encryption_key", randomBytes(32).toString("hex"));
writeSecret("email_token_secret", randomBytes(32).toString("base64url"));
writeSecret("tenant_context_secret", randomBytes(32).toString("base64url"));
writeSecret("rate_limit_hash_secret", randomBytes(32).toString("base64url"));
writeSecret("proxy_shared_secret", randomBytes(32).toString("base64url"));
writeSecret("operator_health_secret", randomBytes(32).toString("base64url"));

// 5. Placeholders for provider secrets (if not existing)
for (const providerSecret of ["google_client_secret", "stripe_secret_key", "stripe_webhook_secret", "smtp_password"]) {
  const filePath = join(secretsDir, providerSecret);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, "", { mode: 0o600 });
  }
}

console.log(`Generated production secrets & PostgreSQL TLS certificates in ${secretsDir}`);
