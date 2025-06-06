/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration for Next.js
  serverExternalPackages: ['@azure/ai-form-recognizer'],
  // Configure API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ];
  },
};

export default nextConfig;
