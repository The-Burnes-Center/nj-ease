/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration for Next.js and Azure Static Web Apps
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
