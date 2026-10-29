/**
 * UNE SAISON SIMULÉE : huit bots, sept jours, quatre visites par jour. On
 * mesure ce que les chiffres de l'arbre tech produisent avant de les servir à
 * des amis. `node simulation/saison.ts [graine] [--csv]`.
 */
import { COULEURS, ELEMENTS, RESSOURCES, SAISON_H, TOUTES, type Ressource } from './donnees.ts'
import { avancer, fortune, nouveauMonde, prixVente, rang, type Joueur, type Monde } from './moteur.ts'
import { visiter, type EtatBot, type Strategie } from './bots.ts'
import { mkdirSync, writeFileSync } from 'node:fs'

/** `QUINTESSENCE_SANS_FOURNEAU=1` : les non-Feu achètent leurs braises au lieu de bâtir un fourneau (l'expérience qui a montré l'avantage du Feu). */
const SANS_FOURNEAU = process.env.QUINTESSENCE_SANS_FOURNEAU === '1'

export const STRATEGIES: Strategie[] = [
  { nom: 'Salamandre-Gnome', elements: ['feu', 'terre'] },
  { nom: 'Ondine-Sylphe', elements: ['eau', 'air'], sansFourneau: SANS_FOURNEAU },
  { nom: 'Salamandre-Ondine', elements: ['feu', 'eau'] },
  { nom: 'Gnome-Sylphe', elements: ['terre', 'air'], sansFourneau: SANS_FOURNEAU },
  { nom: 'Salamandre-Sylphe', elements: ['feu', 'air'] },
  { nom: 'Gnome-Ondine', elements: ['terre', 'eau'], sansFourneau: SANS_FOURNEAU },
  { nom: 'Touche-a-tout', elements: [...ELEMENTS], generaliste: true },
  { nom: 'Brigand', elements: ['feu', 'terre'], agressif: true },
]

/** mulberry32, comme dans keko-test. */
function rngDe(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HEURES_DE_VISITE = [0, 4.5, 10, 14.5]
const DT = 0.25
const SUIVIES: Ressource[] = ['braises', 'fer', 'verre', 'essence', 'flamme', 'alliage', 'mercure', 'runes', 'coeur', 'lingot', 'eauforte', 'prisme']

export interface Resultat {
  monde: Monde
  releve: Record<Ressource, number[]>
}

function resume(m: Monde, j: Joueur): string {
  const bats = j.batiments.map((b) => `${b.nom}${b.niveau > 1 ? b.niveau : ''}`).join(' ')
  const pts = ELEMENTS.map((e) => `${e[0]}${j.points[e]}`).join(' ')
  const stock = TOUTES.filter((r) => j.stock[r] >= 1)
    .map((r) => `${r} ${j.stock[r].toFixed(0)}`)
    .join(', ')
  return `  j${jour(m.t)} or ${j.or.toFixed(0)} | ${pts} | ${bats}${j.four ? ' FOUR' : ''} c${j.couleur}\n    ${stock}`
}

export function jouerSaison(graine: number, suivre?: string): Resultat {
  const rng = rngDe(graine)
  const m = nouveauMonde(STRATEGIES.map((s) => s.nom))
  const etats: EtatBot[] = STRATEGIES.map(() => ({ pleinesVu: 0 }))
  const visites: { t: number; bot: number }[] = []
  for (let bot = 0; bot < STRATEGIES.length; bot++)
    for (let jour = 0; jour < 7; jour++) for (const h of HEURES_DE_VISITE) visites.push({ t: 24 * jour + h + (rng() - 0.5) * 1.5, bot })
  visites.sort((a, b) => a.t - b.t)
  const releve = {} as Record<Ressource, number[]>
  for (const r of TOUTES) releve[r] = []
  let i = 0
  while (m.t < SAISON_H - 1e-9) {
    while (i < visites.length && visites[i]!.t < m.t + DT) {
      const v = visites[i]!
      const j = m.joueurs[v.bot]!
      const avant = suivre === j.nom ? resume(m, j) : ''
      visiter(m, j, STRATEGIES[v.bot]!, etats[v.bot]!)
      if (suivre === j.nom) console.log(`${avant}\n  → or ${j.or.toFixed(0)} | ${j.batiments.map((b) => `${b.nom}${b.niveau > 1 ? b.niveau : ''}`).join(' ')}${j.four ? ' FOUR' : ''}`)
      i++
    }
    avancer(m, DT)
    if (Math.abs(m.t - Math.round(m.t)) < 1e-6) for (const r of TOUTES) releve[r].push(prixVente(m, r))
  }
  return { monde: m, releve }
}

function jour(t: number): string {
  return (t / 24 + 1).toFixed(1)
}

function colonne(s: string | number, n: number): string {
  const t = typeof s === 'number' ? s.toFixed(0) : s
  return t.length >= n ? t : t + ' '.repeat(n - t.length)
}

export function rapport(res: Resultat, graine: number): string {
  const m = res.monde
  const lignes: string[] = []
  lignes.push(`=== Saison, graine ${graine} ===`)
  const rouges = m.joueurs.filter((j) => j.couleur >= 4).sort((a, b) => a.journal.couleurs[3]! - b.journal.couleurs[3]!)
  if (rouges.length > 0) lignes.push(`Vainqueur : ${rouges[0]!.nom}, pierre philosophale au jour ${jour(rouges[0]!.journal.couleurs[3]!)}`)
  else {
    const tete = [...m.joueurs].sort((a, b) => b.couleur - a.couleur || fortune(m, b) - fortune(m, a))[0]!
    lignes.push(`Personne n'atteint le rouge ; en tête : ${tete.nom} (${COULEURS[tete.couleur - 1]?.nom ?? 'aucune couleur'}, ${fortune(m, tete).toFixed(0)} or)`)
  }
  lignes.push('')
  lignes.push(colonne('joueur', 19) + colonne('couleurs (jour)', 24) + colonne('maîtrises (jour)', 22) + colonne('chef', 6) + colonne('four', 6) + colonne('bât.', 5) + colonne('or', 8) + colonne('fortune', 9) + colonne('chefs p/a/v', 13) + colonne('arrêt h', 9) + colonne('plein h', 9) + colonne('att f/r', 8) + colonne('comptoir v/a', 14) + colonne('joueurs v/a', 13))
  for (const j of m.joueurs) {
    const couleurs = j.journal.couleurs.map((t, c) => `${COULEURS[c]!.nom} ${jour(t)}`).join(', ') || '—'
    const maitrises = j.maitrises.map((e, i) => `${e} ${jour(j.journal.maitrises[i]!)}`).join(', ') || ELEMENTS.filter((e) => rang(j, e) === 'compagnon').map((e) => e[0]).join('') + ' (comp.)'
    lignes.push(
      colonne(j.nom, 19) +
        colonne(couleurs, 24) +
        colonne(maitrises, 22) +
        colonne(j.journal.chef === null ? '—' : jour(j.journal.chef), 6) +
        colonne(j.journal.four === null ? '—' : jour(j.journal.four), 6) +
        colonne(j.batiments.length + (j.four ? 1 : 0), 5) +
        colonne(j.or, 8) +
        colonne(fortune(m, j), 9) +
        colonne(`${j.journal.chefsProduits}/${j.journal.chefsAchetes}/${j.journal.chefsVendus}`, 13) +
        colonne(j.journal.heuresArretees, 9) +
        colonne(j.journal.heuresPleines, 9) +
        colonne(`${j.journal.attaquesFaites}/${j.journal.attaquesRecues}`, 8) +
        colonne(`${j.journal.orVentesComptoir.toFixed(0)}/${j.journal.orAchatsComptoir.toFixed(0)}`, 14) +
        colonne(`${j.journal.orVentesJoueurs.toFixed(0)}/${j.journal.orAchatsJoueurs.toFixed(0)}`, 13),
    )
  }
  lignes.push('')
  lignes.push(colonne('ressource', 11) + colonne('min ×', 7) + colonne('max ×', 7) + colonne('moy ×', 7) + colonne('comptoir', 10) + colonne('joueurs', 9))
  for (const r of SUIVIES) {
    const p = res.releve[r].map((x) => x / RESSOURCES[r].prix)
    const moy = p.reduce((a, b) => a + b, 0) / p.length
    lignes.push(colonne(r, 11) + colonne(Math.min(...p).toFixed(2), 7) + colonne(Math.max(...p).toFixed(2), 7) + colonne(moy.toFixed(2), 7) + colonne(m.volumeComptoir[r], 10) + colonne(m.volumeJoueurs[r], 9))
  }
  lignes.push('')
  lignes.push(`Gazette : ${m.gazette.length} faits (${m.gazette.slice(0, 3).join(' · ')}${m.gazette.length > 3 ? ' · …' : ''})`)
  return lignes.join('\n')
}

function csv(res: Resultat): string {
  const lignes = ['heure,' + SUIVIES.join(',')]
  const n = res.releve[SUIVIES[0]!].length
  for (let h = 0; h < n; h++) lignes.push(`${h + 1},` + SUIVIES.map((r) => (res.releve[r][h]! / RESSOURCES[r].prix).toFixed(3)).join(','))
  return lignes.join('\n')
}

/** Ce qui manque le plus souvent, en heures par saison : « braises 210, fer 80 ». */
function manques(js: Joueur[], n: number): string {
  const total: Partial<Record<Ressource, number>> = {}
  for (const j of js) for (const [r, h] of Object.entries(j.journal.arrets)) total[r as Ressource] = (total[r as Ressource] ?? 0) + (h ?? 0) / n
  return Object.entries(total)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([r, h]) => `${r} ${(h ?? 0).toFixed(0)}`)
    .join(', ')
}

/** Plusieurs saisons d'un coup : par stratégie, le jour moyen de chaque étape, et le sort de la saison. */
export function lot(n: number): string {
  const lignes: string[] = []
  const resultats = Array.from({ length: n }, (_, i) => jouerSaison(i + 1))
  const moy = (xs: number[]): string => (xs.length === 0 ? '—' : `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)}${xs.length < n ? ` (${xs.length}/${n})` : ''}`)
  lignes.push(`=== ${n} saisons ===`)
  const rouges = resultats.map((r) => r.monde.joueurs.filter((j) => j.couleur >= 4).map((j) => j.journal.couleurs[3]!).sort((a, b) => a - b)[0]).filter((t): t is number => t !== undefined)
  lignes.push(`Pierre philosophale atteinte dans ${rouges.length} saison(s) sur ${n}${rouges.length > 0 ? `, au jour ${moy(rouges.map((t) => t / 24 + 1))} en moyenne` : ''}`)
  lignes.push('')
  lignes.push(colonne('stratégie', 19) + colonne('maître 1', 10) + colonne('maître 2', 10) + colonne('chef', 10) + colonne('four', 10) + colonne('noir', 10) + colonne('blanc', 10) + colonne('jaune', 10) + colonne('rouge', 10) + colonne('fortune', 9) + colonne('arrêt h', 8))
  STRATEGIES.forEach((s, i) => {
    const js = resultats.map((r) => r.monde.joueurs[i]!)
    const jours = (f: (j: Joueur) => number | undefined): string => moy(js.map(f).filter((t): t is number => t !== undefined).map((t) => t / 24 + 1))
    lignes.push(
      colonne(s.nom, 19) +
        colonne(jours((j) => j.journal.maitrises[0]), 10) +
        colonne(jours((j) => j.journal.maitrises[1]), 10) +
        colonne(jours((j) => j.journal.chef ?? undefined), 10) +
        colonne(jours((j) => j.journal.four ?? undefined), 10) +
        colonne(jours((j) => j.journal.couleurs[0]), 10) +
        colonne(jours((j) => j.journal.couleurs[1]), 10) +
        colonne(jours((j) => j.journal.couleurs[2]), 10) +
        colonne(jours((j) => j.journal.couleurs[3]), 10) +
        colonne(js.reduce((a, j, k) => a + fortune(resultats[k]!.monde, j), 0) / n, 9) +
        colonne(js.reduce((a, j) => a + j.journal.heuresArretees, 0) / n, 8) +
        '  ' +
        manques(js, n),
    )
  })
  return lignes.join('\n')
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('saison.ts')) {
  const lotDe = process.argv.find((a) => a.startsWith('--lot='))
  if (lotDe !== undefined) {
    console.log(lot(Number(lotDe.slice('--lot='.length))))
    process.exit(0)
  }
  const graine = Number(process.argv[2] ?? 1)
  const suivre = process.argv.find((a) => a.startsWith('--suivre='))?.slice('--suivre='.length)
  const res = jouerSaison(graine, suivre)
  console.log(rapport(res, graine))
  if (process.argv.includes('--csv')) {
    mkdirSync(new URL('./resultats/', import.meta.url), { recursive: true })
    const chemin = new URL(`./resultats/prix-${graine}.csv`, import.meta.url)
    writeFileSync(chemin, csv(res))
    console.log(`\nPrix horaires : ${chemin.pathname}`)
  }
}
