import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Scans are uploaded through a server action, one file per call.
    serverActions: { bodySizeLimit: "30mb" },
    // /admin/* passes through middleware, which otherwise buffers only 10 MB of the request body.
    middlewareClientMaxBodySize: "30mb",
  },
  serverExternalPackages: ["firebase-admin", "archiver"],
};

export default nextConfig;
