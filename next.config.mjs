/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { esmExternals: 'loose' },
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
      'tldraw': require.resolve('tldraw/dist/index.mjs'),
      '@tldraw/editor': require.resolve('@tldraw/editor/dist/index.mjs'),
      '@tldraw/utils': require.resolve('@tldraw/utils/dist/index.mjs'),
      '@tldraw/state': require.resolve('@tldraw/state/dist/index.mjs'),
      '@tldraw/state-react': require.resolve('@tldraw/state-react/dist/index.mjs'),
      '@tldraw/store': require.resolve('@tldraw/store/dist/index.mjs'),
      '@tldraw/validate': require.resolve('@tldraw/validate/dist/index.mjs'),
      '@tldraw/tlschema': require.resolve('@tldraw/tlschema/dist/index.mjs'),
    };
    return config;
  },
};

export default nextConfig;