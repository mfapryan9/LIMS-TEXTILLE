/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Foto hasil uji dikirim lewat Server Action (dikompres di browser, maks. 4 MB)
    serverActions: { bodySizeLimit: "5mb" },
  },
  // pdf.js (baca PDF permintaan pengujian di browser) punya dependensi opsional "canvas" khusus Node: abaikan
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;