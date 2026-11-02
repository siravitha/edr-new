/** @type {import('next').NextConfig} */
const config = {
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
};
export default config;