import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (server.js + only the node_modules
  // actually needed at runtime) — required for a slim Cloud Run container image
  // (docs/implementation-status.md, Cloud Run deployment).
  output: "standalone",
};

export default nextConfig;
