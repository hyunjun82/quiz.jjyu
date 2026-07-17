/** @type {import('next').NextConfig} */
const nextConfig = {
  // 정적 내보내기: Cloudflare Pages에 out/ 디렉터리를 그대로 배포
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
