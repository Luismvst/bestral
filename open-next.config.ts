import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Sin incremental cache: Bestral no usa ISR, todo el estado vive en el cliente
// o en la base de datos. Añadir R2 aquí solo cuando haga falta de verdad.
export default defineCloudflareConfig({});
