// Creates the login settings for .env.local: a password hash, a session
// secret, and the PC's home-network address for phone access.
// Usage: npm run auth:setup   (prints the lines; nothing is written or sent)
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { createInterface } from "node:readline";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/server/password";

// Reads one line. In a terminal, typing is hidden; piped input is read as lines.
let pipedLines: AsyncIterator<string> | null = null;

async function ask(question: string): Promise<string> {
  process.stdout.write(question);
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    pipedLines ??= createInterface({ input: stdin })[Symbol.asyncIterator]();
    const line = await pipedLines.next();
    process.stdout.write("\n");
    return line.done ? "" : line.value;
  }
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        value = ch === "\u007f" || ch === "\b" ? value.slice(0, -1) : value + ch;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

// Virtual adapters (WSL, Hyper-V, VMs, Docker) are not reachable from a phone.
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vmware|docker|loopback/i;

function lanAddresses(): string[] {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
    .flatMap(([, nets]) => nets ?? [])
    .filter((net) => net.family === "IPv4" && !net.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address))
    .map((net) => net.address);
}

async function main() {
  const password = await ask(`Choose a password (at least ${MIN_PASSWORD_LENGTH} characters): `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }
  if ((await ask("Type it again: ")) !== password) {
    console.error("The passwords don't match.");
    process.exitCode = 1;
    return;
  }

  const addresses = lanAddresses();
  console.log("\nAdd these lines to .env.local (replace any old ones), then restart the app:\n");
  console.log(`APP_PASSWORD_HASH=${await hashPassword(password)}`);
  console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
  console.log(`APP_ALLOWED_HOSTS=${addresses.join(",")}`);
  if (addresses.length > 0) {
    console.log(`\nOn your phone (same Wi-Fi), open: ${addresses.map((a) => `http://${a}:3000`).join("  or  ")}`);
  } else {
    console.log("\nNo home-network address found; add the PC's IP to APP_ALLOWED_HOSTS yourself.");
  }
}

void main().then(() => process.exit());
