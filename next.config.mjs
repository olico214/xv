/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'server-images.soiteg.com',
        pathname: '/**', // Permite cualquier ruta
      },
    ],
  },
};

export default nextConfig;
