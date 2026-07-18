import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Mirror of ~/whollykaw/worker-seo/widgets/vite.config.js.
 *
 * Each widget builds to a single self-contained IIFE file. CSS is imported with
 * `?inline` inside each widget and injected into a Shadow DOM root, so the build
 * emits ONE .js per widget and nothing leaks into the Shopify theme's styles.
 * The built files are committed and served by worker-seo at
 * https://tmolecule.com/learn/widgets/<name>.js (add the route in ../src/index.js).
 *
 *   npm run build:brew   -> dist/brew-guide.js
 *   npm run dev          -> playground at / (mounts brew-guide with sample data)
 */
const WIDGETS = {
  'brew-guide': resolve(__dirname, 'src/brew-guide/index.js'),
  'cost-per-cup': resolve(__dirname, 'src/cost-per-cup/index.js'), // #3
  'tea-finder': resolve(__dirname, 'src/tea-finder/index.js'), // #1 flagship
  'caffeine-comparator': resolve(__dirname, 'src/caffeine-comparator/index.js'), // #5 caffeine-by-tea comparator
  'collagen-calculator': resolve(__dirname, 'src/collagen-calculator/index.js'), // #6 collagen-per-day (Vahdam-benchmark)
  'sugar-saved': resolve(__dirname, 'src/sugar-saved/index.js'),                  // #7 café-swap sugar saved
  'spice-blend-builder': resolve(__dirname, 'src/spice-blend-builder/index.js'),  // #8 chai spice-blend builder
  'advisor': resolve(__dirname, 'src/advisor/index.js'),                          // #9 RAG chat advisor
};

export default defineConfig(() => {
  const widget = process.env.WIDGET;

  // Library build: one widget -> one IIFE file.
  if (widget && WIDGETS[widget]) {
    const globalName = `TM_${widget.replace(/-/g, '_')}`;
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false, // keep other widgets' output between builds
        cssCodeSplit: false,
        lib: {
          entry: WIDGETS[widget],
          name: globalName,
          formats: ['iife'],
          fileName: () => `${widget}.js`,
        },
      },
    };
  }

  // Dev playground (npm run dev) serves index.html at the project root.
  return { root: '.' };
});
