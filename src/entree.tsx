import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { Jeu } from './render/Jeu.tsx'
import { JeuClic } from './render/clic/JeuClic.tsx'
import './styles.css'

// LA RACINE OUVRE CE SUR QUOI ON TRAVAILLE : le système abstrait, sur sa carte (la base et ses modules). Le prototype
// alchimie reste ouvrable par `?alchimie`. `?carte`, l'adresse du test visuel de la carte, ouvre la même chose.
const alchimie = new URLSearchParams(location.search).has('alchimie')

createRoot(document.getElementById('racine')!).render(<StrictMode>{alchimie ? <Jeu /> : <JeuClic />}</StrictMode>)
