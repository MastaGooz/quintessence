import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { Jeu } from './render/Jeu.tsx'
import './styles.css'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <Jeu />
  </StrictMode>,
)
