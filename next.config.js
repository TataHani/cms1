/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Fonty do grafik raportu tygodniowego czytane z dysku - musza trafic do funkcji na Vercelu.
    outputFileTracingIncludes: {
      '/api/cron/weekly-report': ['./src/fonts/**/*'],
    },
  },
}

module.exports = nextConfig
