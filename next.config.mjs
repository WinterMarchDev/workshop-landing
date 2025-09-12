// next.config.mjs
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const mjs = (pkg) => req.resolve(`${pkg}/dist/index.mjs`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/vendor-advance-slides.html",
        destination: "/slides/vendor-advance",
        permanent: false,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'tldraw': mjs('tldraw'),
      '@tldraw/editor': mjs('@tldraw/editor'),
      '@tldraw/utils': mjs('@tldraw/utils'),
      '@tldraw/state': mjs('@tldraw/state'),
      '@tldraw/state-react': mjs('@tldraw/state-react'),
      '@tldraw/store': mjs('@tldraw/store'),
      '@tldraw/validate': mjs('@tldraw/validate'),
      '@tldraw/tlschema': mjs('@tldraw/tlschema'),
    };
    return config;
  },
};

export default nextConfig;