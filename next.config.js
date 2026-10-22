/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js', 'pdf-parse'],
    cpus: 2,
    workerThreads: false,
  },
  headers: async () => [
    {
      source: '/tesseract/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
  rewrites: async () => {
    return [
      {
        source: '/api/python/:path*',
        destination:
          process.env.NODE_ENV === 'development' && process.env.PYTHON_DEV_PORT
            ? `http://127.0.0.1:${process.env.PYTHON_DEV_PORT}/api/python/:path*`
            : '/api/index.py',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        module: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

