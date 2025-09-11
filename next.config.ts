import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
}

export default nextConfig