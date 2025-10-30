/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 'canvas' をサーバーサイドのバンドルから除外する
      // 'pdf-preview.tsx' は 'ssr: false' なので、
      // サーバー上で 'canvas' が require されることはない
      config.externals.push('canvas');
    }
    return config;
  },
}

export default nextConfig
