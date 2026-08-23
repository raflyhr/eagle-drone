import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Copy WASM & MJS files dari onnxruntime-web ke public/ort-wasm/
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.{wasm,mjs}',
          dest: 'ort-wasm',
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
})
