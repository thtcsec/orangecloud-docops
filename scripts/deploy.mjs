#!/usr/bin/env node
/**
 * Build + deploy with CLOUDFLARE_ENV so the Vite Cloudflare plugin
 * flattens the correct Wrangler environment into dist/.
 *
 * Usage: node scripts/deploy.mjs staging|production
 */
import { spawnSync } from "node:child_process";

const envName = process.argv[2];
if (envName !== "staging" && envName !== "production") {
  console.error("Usage: node scripts/deploy.mjs staging|production");
  process.exit(1);
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  // Cloudspace — OrangeCloud DocOps home account
  process.env.CLOUDFLARE_ACCOUNT_ID = "4c15704ef706b9c8954cd6f9feb678d8";
}

process.env.CLOUDFLARE_ENV = envName;

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build"]);
// Redirected deploy config is already flattened for CLOUDFLARE_ENV — do not pass --env.
run("npx", ["wrangler", "deploy"]);
