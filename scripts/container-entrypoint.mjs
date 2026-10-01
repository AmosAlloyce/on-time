import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const secretNames = ["DATABASE_URL","WORKER_DATABASE_URL","MONITOR_DATABASE_URL","AUTH_SECRET","BOOKING_CAPABILITY_SECRET","BOOKING_CAPABILITY_KEYRING","TOKEN_ENCRYPTION_KEY","EMAIL_TOKEN_SECRET","TENANT_CONTEXT_SECRET","RATE_LIMIT_HASH_SECRET","PROXY_SHARED_SECRET","OPERATOR_HEALTH_SECRET","GOOGLE_CLIENT_SECRET","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","SMTP_PASSWORD"];
for (const name of secretNames) {
  const file = process.env[`${name}_FILE`]; if (!file) continue;
  if (!file.startsWith("/run/secrets/")) throw new Error(`${name}_FILE must be a runtime secret mount.`);
  process.env[name] = readFileSync(file, "utf8").trim(); delete process.env[`${name}_FILE`];
}
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const searchDirs = [
    "/app/apps/web/node_modules/@tempocove/postgresql-client",
    "/app/node_modules/@tempocove/postgresql-client",
  ];
  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      const match = readdirSync(dir).find((file) => file.startsWith("libquery_engine-") && file.endsWith(".so.node"));
      if (match) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(dir, match);
        break;
      }
    }
  }
}
if (!process.argv[2]) throw new Error("Container entrypoint requires an explicit executable.");
if (process.argv.slice(2).some((argument) => argument.endsWith("apps/web/server.js"))) {
  const compiled = readFileSync("/app/apps/web/.next/BUILD_ID", "utf8").trim();
  if (!/^[a-f0-9]{40,64}$/i.test(compiled) || process.env.BUILD_ID !== compiled) throw new Error("Runtime BUILD_ID must exactly match the immutable compiled web identity before listening.");
}
const child = spawn(process.argv[2], process.argv.slice(3), { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM","SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
