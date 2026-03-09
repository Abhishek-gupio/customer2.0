const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawnSync } = require("child_process");
const { config } = require("dotenv");

const prismaDir = __dirname;
const primaryEnvPath = path.join(prismaDir, ".env");
const fallbackEnvPath = path.join(prismaDir, "env");

config({ path: primaryEnvPath });

function parseHostPort(connectionString) {
  try {
    const u = new URL(connectionString);
    return {
      host: u.hostname || "localhost",
      port: Number(u.port || "5432"),
    };
  } catch {
    return { host: "localhost", port: 5432 };
  }
}

function addNoVerifySslMode(connectionString) {
  try {
    const u = new URL(connectionString);
    // Useful for RDS/managed DBs with cert chain issues on some local setups.
    u.searchParams.set("sslmode", "no-verify");
    return u.toString();
  } catch {
    return connectionString;
  }
}

function readFallbackUrl() {
  if (!fs.existsSync(fallbackEnvPath)) return null;
  const raw = fs.readFileSync(fallbackEnvPath, "utf8");
  const match = raw.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || null;
}

function canConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
    socket.connect(port, host);
  });
}

async function resolveUrl() {
  const primary = process.env.DATABASE_URL;
  if (!primary) return null;

  const primaryTarget = parseHostPort(primary);
  if (await canConnect(primaryTarget.host, primaryTarget.port)) {
    return primary;
  }

  const fallback = readFallbackUrl();
  if (!fallback) return primary;

  const fallbackWithSsl = addNoVerifySslMode(fallback);
  const fallbackTarget = parseHostPort(fallbackWithSsl);
  if (await canConnect(fallbackTarget.host, fallbackTarget.port, 3000)) {
    console.log(
      `Primary DB ${primaryTarget.host}:${primaryTarget.port} is down. Using fallback DB ${fallbackTarget.host}:${fallbackTarget.port}.`
    );
    return fallbackWithSsl;
  }

  return primary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node run-prisma-with-fallback.js <prisma args...>");
    process.exit(1);
  }

  const selectedUrl = await resolveUrl();
  if (selectedUrl) {
    process.env.DATABASE_URL = selectedUrl;
  }

  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    cwd: prismaDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error("Prisma runner failed:", err && err.message ? err.message : err);
  process.exit(1);
});
