module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' && {
      '@fullhuman/postcss-purgecss': {
        content: [
          './src/**/*.{js,jsx,ts,tsx}',
          './public/index.html',
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
        safelist: {
          standard: [
            /^bg-/,
            /^text-/,
            /^border-/,
            /^hover:/,
            /^focus:/,
            /^active:/,
            /^group-hover:/,
            /^animate-/,
            /^transition-/,
            /^duration-/,
            /^ease-/,
            /^transform/,
            /^scale-/,
            /^rotate-/,
            /^translate-/,
          ],
          deep: [
            /lucide/,
            /react-hot-toast/,
            /framer-motion/,
          ],
          greedy: [
            /data-\[.*\]/,
            /aria-\[.*\]/,
          ]
        }
      },
      cssnano: {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
          normalizeWhitespace: true,
          reduceIdents: false,
          zindex: false,
        }]
      }
    })
  },
}
