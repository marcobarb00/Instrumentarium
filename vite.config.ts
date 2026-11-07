import { defineConfig } from 'vitest/config';

// Every page is its own HTML entry. Add new instrument pages here.
const pages: Record<string, string> = {
  main: 'index.html',
  quadrant: 'quadrant/index.html',
};

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Three.js alone is ~500 kB minified; it is one cached chunk shared by every page.
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: pages },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
