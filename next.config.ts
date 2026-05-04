import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.137"],
  images: {
    domains: ["localhost"],
  },
};

export default nextConfig;
