import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/javelin-webtools",
  assetPrefix: "/javelin-webtools",
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true } // required for output type export
};

export default nextConfig;
