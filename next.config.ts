import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bestral es una SPA: todo el motor de audio vive en el navegador.
  // El export estático se sirve tal cual en Cloudflare Pages.
  // Lo que necesite servidor (la llamada al LLM) va en functions/api/*,
  // que Pages ejecuta como Function con sus variables de entorno.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
