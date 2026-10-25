import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env automatically
try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on real environment variables
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate, db push) uses the direct/session connection
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
