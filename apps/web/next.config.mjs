/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // عنوان الخلفية يُمرَّر وقت البناء/التشغيل.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
