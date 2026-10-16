// Lets browsers on the Registry's domains upload scans straight to the Storage bucket (signed PUT URLs).
//   npm run cors:prod -- --origins https://registry.akshara.website,https://akshara-registry.vercel.app
import { arg, bucket, target } from "./admin-app";

const DEFAULT_ORIGINS = ["https://registry.akshara.website", "http://localhost:3000"];

async function main() {
  const origins = (arg("origins") ?? DEFAULT_ORIGINS.join(","))
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  await bucket.setCorsConfiguration([
    { origin: origins, method: ["PUT", "GET", "HEAD"], responseHeader: ["Content-Type"], maxAgeSeconds: 3600 },
  ]);
  const [meta] = await bucket.getMetadata();
  console.log(`✓ CORS on ${bucket.name} (${target()}):`, JSON.stringify(meta.cors));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
