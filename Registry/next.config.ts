import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Scans are uploaded through a server action, one file per call.
    serverActions: { bodySizeLimit: "30mb" },
    // /admin/* passes through middleware, which otherwise buffers only 10 MB of the request body.
    middlewareClientMaxBodySize: "30mb",
  },
  serverExternalPackages: ["firebase-admin", "archiver"],
  // Firestore (via google-gax) loads .proto/.json files at runtime; make sure they are shipped in every
  // serverless function. Turbopack builds in Next 15 left them out, crashing every server route on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/google-gax/build/protos/**/*"],
  },
};

export default nextConfig;
