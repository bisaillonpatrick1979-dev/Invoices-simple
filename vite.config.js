import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le moment de la construction est gravé dans le code. Il s'affiche au bas des
// réglages : c'est la seule façon de savoir, depuis un téléphone, si on
// regarde la dernière version ou une copie gardée en cache par le navigateur.
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})
