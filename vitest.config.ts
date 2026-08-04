import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(__dirname, "src/worker/db/migrations"),
      );
      return {
        // Keep tests fully local — AI/remote bindings require an account_id selection.
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "local",
            APP_BASE_URL: "http://localhost:5173",
            LOCAL_DEV_AUTH_ENABLED: "true",
            LOCAL_DEV_AUTH_EMAIL: "admin@docops.local",
            LOCAL_DEV_AUTH_ROLE: "admin",
            LOCAL_DEV_AUTH_DISPLAY_NAME: "Local Admin",
            MAX_UPLOAD_BYTES: "10485760",
            PROCESSING_VERSION: "v1",
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@worker": path.resolve(__dirname, "src/worker"),
    },
  },
  test: {
    setupFiles: ["./tests/apply-migrations.ts"],
  },
});
