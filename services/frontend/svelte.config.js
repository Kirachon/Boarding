import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter({
      // default options are shown
      out: 'build',
      precompress: false,
      envPrefix: 'VITE_'
    }),
    
    // Application configuration
    alias: {
      $components: 'src/components',
      $stores: 'src/stores',
      $utils: 'src/utils',
      $types: 'src/types'
    },

    // CSP configuration for security
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https:'],
        'font-src': ['self'],
        'connect-src': ['self', 'ws:', 'wss:'],
        'media-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'upgrade-insecure-requests': true
      }
    },

    // Service worker configuration
    serviceWorker: {
      register: false
    },

    // Version configuration
    version: {
      name: process.env.npm_package_version || '1.0.0'
    }
  }
};

export default config;
