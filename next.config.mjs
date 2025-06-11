/**
 * next.config.mjs
 * ----------------
 * Central configuration for the Next.js front-end.  The options below are
 * tuned for deployment on **Azure Static Web Apps** which expects a purely
 * static export (no on-demand server functions – our dynamic pieces live
 * in the `/api` folder as Azure Functions instead).
 *
 * Key options
 * -----------
 * • output: 'export'       – Instructs `next build` to generate static HTML
 *   files via `next export`.  This is compatible with Azure Static Web Apps
 *   as well as other static hosts (Netlify, Vercel-static, GitHub Pages).
 *
 * • trailingSlash: true    – Generates `/about/index.html` instead of
 *   `/about.html` which is a common static-hosting convention.  Keeps URL
 *   parity between local dev (`/about`) and exported output (`/about/`).
 *
 * • images.unoptimized     – Disables the default Next.js Image Optimizer
 *   since SWA does not provide the required on-the-fly optimisation Lambda.
 *   All images are served as-is.  If you need optimisation, switch to an
 *   external loader or a 3rd-party CDN.
 */
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
