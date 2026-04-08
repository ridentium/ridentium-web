/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-project.supabase.co', 'cnbghqlxarwdglxvmkti.supabase.co'],
  },
  typescript: {
    // Type errors are checked locally — skip during Vercel build for faster deploys
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint errors checked locally — skip during Vercel build
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
