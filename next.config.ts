import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
};

// Only initialize the Cloudflare proxy in local dev — during `next build`
// the worker entrypoint wires the context itself, and initializing here
// would try to start a remote wrangler proxy and fail unauthenticated.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default config;
