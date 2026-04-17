/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Forza HTTPS per 1 anno — elimina warning "connessione non sicura" su mobile
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Impedisce framing (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Blocca MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy — disabilita feature non necessarie
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  images: {
    domains: ['your-supabase-project.supabase.co', 'cnbghqlxarwdglxvmkti.supabase.co'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
