/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Foto hasil uji dikirim lewat Server Action (dikompres di browser, maks. 4 MB)
    serverActions: { bodySizeLimit: "5mb" },
  },
};

module.exports = nextConfig;