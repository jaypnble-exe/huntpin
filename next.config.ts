import type { NextConfig } from "next";

// Hosts allowed besides localhost once login is set up (see src/middleware.ts).
const allowedHosts = (process.env.APP_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().split(":")[0])
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Lets a phone on the home network load the dev server's scripts.
  allowedDevOrigins: allowedHosts,
  // Public values inlined into the browser bundle. PORTFOLIO_URL is meant to
  // be shared with prospects, so exposing it is fine. Never add secrets here.
  env: {
    PORTFOLIO_URL: process.env.PORTFOLIO_URL ?? "",
  },
};

export default nextConfig;
