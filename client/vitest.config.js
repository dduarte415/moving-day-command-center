import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Kept separate from vite.config.js on purpose: the production build runs
// `vite build` on a box where devDependencies may be pruned, and importing
// anything from `vitest/config` there would break the deploy. Vitest reads
// this file in preference to vite.config.js, reusing its plugins.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
    },
  })
);
