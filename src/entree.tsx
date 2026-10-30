import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { Jeu } from './render/Jeu.tsx'
import { Carte } from './render/carte/Carte.tsx'
import { JeuClic } from './render/clic/JeuClic.tsx'
import './styles.css'

// LA RACINE OUVRE CE SUR QUOI ON TRAVAILLE : le système abstrait. Le prototype alchimie reste ouvrable par `?alchimie` ;
// `?carte` ouvre le test visuel de la carte qu'on fait glisser et qu'on zoome (Keko, 30/10).
const params = new URLSearchParams(location.search)
const page = params.has('alchimie') ? <Jeu /> : params.has('carte') ? <Carte /> : <JeuClic />

createRoot(document.getElementById('racine')!).render(<StrictMode>{page}</StrictMode>)
