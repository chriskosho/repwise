import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Lists every file the build produces and writes dist/sw.js so the browser can keep a full
// copy of the app. The version changes whenever any file name (which includes its content
// hash) changes, which is what makes browsers install the new copy.
const PUBLIC_FILES = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
function offlinePlugin() {
  let base = '/';
  return {
    name: 'repwise-offline',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort();
      const urls = [base, ...files, ...PUBLIC_FILES].map((f) => (f === base ? base : base + f));
      const version = createHash('sha1').update(urls.join('\n')).digest('hex').slice(0, 10);
      const source = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(urls, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Served from https://<user>.github.io/repwise/ on GitHub Pages.
export default defineConfig({
  base: '/repwise/',
  plugins: [react(), offlinePlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
  },
});
