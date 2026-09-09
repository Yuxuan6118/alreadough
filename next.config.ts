import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The beta runs on a plain Cloudflare Worker without the Cloudflare Images
  // add-on, so serve source images directly instead of routing through the
  // optimizer. Re-enable optimization once an IMAGES binding is configured.
  images: { unoptimized: true },
};

export default nextConfig;
