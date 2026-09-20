import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // ignore
  }
}

const databaseUrl =
  process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("YOUR_PROJECT_REF")
    ? process.env.DATABASE_URL
    : "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
