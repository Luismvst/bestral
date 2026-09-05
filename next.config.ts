import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;

// Permite que `next dev` vea los bindings de Cloudflare en local.
// Requerido por @opennextjs/cloudflare.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
void initOpenNextCloudflareForDev();
