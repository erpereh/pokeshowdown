import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // `next dev` otherwise appends a generated block to the repo's AGENTS.md.
  agentRules: false,
  serverExternalPackages: ["pokemon-showdown"],
  // Dex loads dist/data and dist/config with dynamic require(); NFT does not follow those.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pokemon-showdown/dist/data/**/*",
      "./node_modules/pokemon-showdown/dist/config/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/assets/generated/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
