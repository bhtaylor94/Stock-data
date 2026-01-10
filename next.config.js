/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for sql.js (used server-side only).
    // Next.js (webpack 5) requires this explicit flag.
    config.experiments = { ...(config.experiments || {}), asyncWebAssembly: true };

    // Ensure .wasm files are treated correctly.
    config.module.rules.push({ test: /\.wasm$/, type: 'webassembly/async' });

    // Prevent client bundles from trying to include sql.js.
    if (!isServer) {
      config.resolve.alias = { ...(config.resolve.alias || {}), 'sql.js': false };
    }

    return config;
  },
}

module.exports = nextConfig
