import { fileURLToPath, URL } from 'node:url'

import { defineConfig,loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({command,mode})=>{
  
  const env = loadEnv(mode, process.cwd(), '');
  return{
  plugins: [vue()],
  base:'/BandcampMonitor',
  build:{
    emptyOutDir:true,
    outDir:env.VITE_OUT_DIR || './dist/'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
}})
