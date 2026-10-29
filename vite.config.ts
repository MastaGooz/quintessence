import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** La date du build, affichée dans la page : Keko vérifie qu'il ne voit pas une version en cache. */
const dateDuBuild = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages sert le dépôt sous son nom ; en dev, la racine.
  base: command === 'build' ? '/quintessence/' : '/',
  define: { __DATE_DU_BUILD__: JSON.stringify(dateDuBuild) },
}))
