/**
 * UNE SAISON DU SYSTÈME ABSTRAIT : huit joueurs simulés, sept jours, un
 * marché commun à vingt-quatre sortes. On mesure ce que les chiffres de
 * `logic/clic/donnees.ts` produisent avant de les servir à des amis : l'ordre
 * de grandeur gagné par jour, les prix, les modules fabriqués par rareté, par
 * sorte et par qualité, la part branchée, les prestiges.
 * `node simulation/clic.ts [graine] [--suivre=Nom] [--csv]`.
 */
import {
  ACHAT, COULEURS, EFFETS, FABRICATION, FORMES, MARCHE, MELANGE, MELANGEURS, NIVEAU, NIVEAU_SOURCE, PRESTIGE, RAFFINERIES, RARETES, SAISON_H, SORTES, SOURCES, couleurDe, formeDe, sorteDe,
} from '../src/logic/clic/donnees.ts'
import { avancer, couleurDominanteDe, debitTotal, genreDe, modulesDe, nouveauMonde, prixCourant, sortie, soute, typeDe, type Joueur, type Monde } from '../src/logic/clic/moteur.ts'
import { visiter } from '../src/logic/clic/bots.ts'
import { BOTS, PAS } from '../src/logic/clic/partie.ts'
import { graineDe, rngDe } from '../src/logic/rng.ts'

const args = process.argv.slice(2)
const graine = Number(args.find((a) => /^\d+$/.test(a)) ?? '1')
const suivre = args.find((a) => a.startsWith('--suivre='))?.slice(9)
const csv = args.includes('--csv')

// LE BALAYAGE : des variables d'environnement pour essayer d'autres chiffres sans toucher aux données.
const echelleLot = Number(process.env.QC_LOT ?? '1')
for (const p of SOURCES) (p as { lot: number }).lot *= echelleLot
// `QC_COUT=15` : chaque source coûte 15 fois la précédente ; `QC_TIER=4` : le lot de chaque source vaut 4 fois la précédente.
if (process.env.QC_COUT !== undefined) SOURCES.forEach((p, i) => { if (i > 1) (p.cout as { quantite: number }).quantite = (SOURCES[1]?.cout.quantite ?? 40) * Math.pow(Number(process.env.QC_COUT), i - 1) })
if (process.env.QC_TIER !== undefined) SOURCES.forEach((p, i) => { if (i > 0) (p as { lot: number }).lot = Math.round((SOURCES[0]?.lot ?? 1) * Math.pow(Number(process.env.QC_TIER), i)) })
if (process.env.QC_BASE !== undefined) (PRESTIGE as { base: number }).base = Number(process.env.QC_BASE)
if (process.env.QC_PAR !== undefined) (PRESTIGE as { parPoint: number }).parPoint = Number(process.env.QC_PAR)
// `QC_PREMIER=0.5` le premier niveau d'un module en part de sa valeur ; `QC_NIV=1.25` la croissance d'un niveau ; `QC_PIECE=3` celle d'une pièce de plus ; `QC_NIVSRC=2` la croissance d'un niveau de source ; `QC_PERIODE=5` la période de l'horloge.
if (process.env.QC_PREMIER !== undefined) (NIVEAU as { premier: number }).premier = Number(process.env.QC_PREMIER)
if (process.env.QC_NIV !== undefined) (NIVEAU as { croissance: number }).croissance = Number(process.env.QC_NIV)
if (process.env.QC_NIVSRC !== undefined) (NIVEAU_SOURCE as { croissance: number }).croissance = Number(process.env.QC_NIVSRC)
if (process.env.QC_PIECE !== undefined) (ACHAT as { croissance: number }).croissance = Number(process.env.QC_PIECE)
if (process.env.QC_PERIODE !== undefined) (EFFETS as { periode: number }).periode = Number(process.env.QC_PERIODE)
if (process.env.QC_AJOUT !== undefined) (EFFETS as { ajout: number }).ajout = Number(process.env.QC_AJOUT)
if (process.env.QC_MULT !== undefined) (EFFETS as { multiplicateur: number }).multiplicateur = Number(process.env.QC_MULT)
if (process.env.QC_CHANCE !== undefined) (EFFETS as { chance: number }).chance = Number(process.env.QC_CHANCE)
// `QC_PART=0.7` la part de chaque effet d'un module mélangé.
if (process.env.QC_PART !== undefined) (MELANGE as { part: number }).part = Number(process.env.QC_PART)
// LA FABRICATION : `QC_FAB=0.4` la part de la valeur d'un module que coûte le premier ; `QC_FABX=1.15` ce que coûte chaque module de plus de la sorte ; `QC_QUAL=1,5,25,125` les multiplicateurs des qualités ; `QC_RAFF=0.5` divise le prix des raffineries et des mélangeurs par deux.
if (process.env.QC_FAB !== undefined) (FABRICATION as { part: number }).part = Number(process.env.QC_FAB)
if (process.env.QC_FABX !== undefined) (FABRICATION as { croissance: number }).croissance = Number(process.env.QC_FABX)
if (process.env.QC_FABT !== undefined) (FABRICATION as { croissanceTotale: number }).croissanceTotale = Number(process.env.QC_FABT)
if (process.env.QC_QUAL !== undefined) process.env.QC_QUAL.split(',').forEach((v, k) => { const q = FABRICATION.qualites[k]; if (q !== undefined) (q as { mult: number }).mult = Number(v) })
if (process.env.QC_RAFF !== undefined) for (const a of [...RAFFINERIES, ...MELANGEURS]) (a.cout as { quantite: number }).quantite *= Number(process.env.QC_RAFF)
// LE MARCHÉ : `QC_DEMANDE=200` la demande minimale, `QC_TAMPON=2` les heures de production qui font la demande, `QC_DEMIVIE=2`.
if (process.env.QC_DEMANDE !== undefined) (MARCHE as { demandeMin: number }).demandeMin = Number(process.env.QC_DEMANDE)
if (process.env.QC_TAMPON !== undefined) (MARCHE as { tampon: number }).tampon = Number(process.env.QC_TAMPON)
if (process.env.QC_DEMIVIE !== undefined) (MARCHE as { demiVie: number }).demiVie = Number(process.env.QC_DEMIVIE)
// LES RARETÉS : `QC_RARETE=1,1.5,2.5,4,7` les multiplicateurs d'effet.
if (process.env.QC_RARETE !== undefined) (RARETES as { effet: number[] }).effet = process.env.QC_RARETE.split(',').map(Number)

/** Le premier joueur joue comme un humain assidu : quatre visites, cent tapes, le rouge. */
const JOUEURS = [{ nom: 'Keko', tapes: 100, seuilPrestige: 2, visites: 4, couleur: 0 }, ...BOTS]

function abrege(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  const u = ['k', 'M', 'G', 'T', 'P', 'E']
  let k = -1
  while (n >= 1000 && k < u.length - 1) {
    n /= 1000
    k++
  }
  return `${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)} ${u[k]}`
}

const LETTRES_RARETE = 'cprEL'
/** Les formes en majuscules (O rond, C carré, T triangle, L losange), les couleurs en minuscules (r v b j c m) : « Cb » = carré bleu. */
const LETTRES_FORME = 'OCTL'
const LETTRES_COULEUR = 'rvbjcm'
const code = (sorte: number): string => `${LETTRES_FORME[formeDe(sorte)]}${LETTRES_COULEUR[couleurDe(sorte)]}`

/** Les générateurs avec leurs modules : « S0r[Cb12r Cv8 Tv5E] » = la source rouge de départ qui porte un carré bleu niveau 12 rare, un carré vert niveau 8, un triangle vert niveau 5 épique ; « R1→Cb », « M1→Om ». */
function resume(m: Monde, j: Joueur): string {
  const prods = j.producteurs
    .map((p) => {
      const t = typeDe(p)
      const mods = modulesDe(j, p).map((mo) => `${code(sorteDe(mo.couleur, mo.forme))}${mo.niveau}${mo.rarete > 0 ? LETTRES_RARETE[mo.rarete] : ''}`).join(' ')
      const g = genreDe(p)
      const tete = g === 'source' ? `${t.id.toUpperCase()}${LETTRES_COULEUR[p.couleur]}${p.niveau > 1 ? `n${p.niveau}` : ''}` : `${t.id.toUpperCase()}→${code(sortie(p))}`
      return `${tete}[${mods}]`
    })
    .join(' ')
  const s = soute(j)
  const stock = j.matiere.map((q, k) => (q >= 1 ? `${code(k)}${abrege(q)}` : '')).filter((x) => x !== '').join(' ')
  const raretes = RARETES.noms.map((_, r) => j.modules.filter((mo) => mo.rarete === r).length).join('/')
  return `${abrege(j.or)} or | ${abrege(debitTotal(j))}/s | stock ${stock} | ${prods}${s.length > 0 ? ` +${s.length} en soute` : ''} | modules c/p/r/E/L ${raretes} | fabriqués ${j.journal.fabrications}, fusions ${j.journal.fusions} | pts ${j.points} (×${j.prestiges}) | total ${abrege(j.total)}`
}

/** Les prix : par couleur, les quatre formes (rond/carré/triangle/losange). */
function prix(m: Monde): string {
  return Array.from({ length: COULEURS }, (_, c) => `${LETTRES_COULEUR[c]} ${Array.from({ length: FORMES }, (_, f) => prixCourant(m, sorteDe(c, f)).toFixed(2)).join('/')}`).join('  ')
}

export function jouerSaison(): Monde {
  const m = nouveauMonde(JOUEURS.map((s) => s.nom), graine)
  const visites: { t: number; bot: number }[] = []
  JOUEURS.forEach((s, bot) => {
    for (let jour = 0; jour < 7; jour++) {
      const rng = rngDe(graineDe(graine, bot + 1, jour + 1))
      for (let k = 0; k < s.visites; k++) visites.push({ t: 24 * jour + (16 * (k + rng())) / s.visites, bot })
    }
  })
  visites.sort((a, b) => a.t - b.t)
  let i = 0
  const lignes: string[] = []
  while (m.t < SAISON_H - 1e-9) {
    while (i < visites.length && visites[i]!.t < m.t + PAS) {
      const v = visites[i]!
      const j = m.joueurs[v.bot]!
      const avant = suivre === j.nom ? resume(m, j) : ''
      visiter(m, j, JOUEURS[v.bot]!)
      if (suivre === j.nom) console.log(`  ${(v.t / 24).toFixed(2)} j  ${avant}\n          → ${resume(m, j)}\n          prix ${prix(m)}`)
      i++
    }
    avancer(m, PAS)
    if (Math.abs(m.t - Math.round(m.t)) < 1e-6 && Math.round(m.t) % 24 === 0) {
      const jour = Math.round(m.t) / 24
      if (!csv) console.error(`  … jour ${jour} (${Math.round(performance.now() / 1000)} s, ${m.joueurs.reduce((s, j) => s + j.modules.length, 0)} modules)`)
      const totaux = m.joueurs.map((j) => j.total).sort((a, b) => a - b)
      const median = totaux[Math.floor(totaux.length / 2)]!
      const keko = m.joueurs[0]!
      lignes.push(
        csv
          ? [jour, median, totaux[0], totaux[totaux.length - 1]].join(';')
          : `jour ${jour} | total médian ${abrege(median)} (min ${abrege(totaux[0]!)}, max ${abrege(totaux[totaux.length - 1]!)})\n   prix ${prix(m)}\n   Keko : ${resume(m, keko)}`,
      )
    }
  }
  for (const l of lignes) console.log(l)
  return m
}

const m = jouerSaison()
console.log('\nclassement final (total produit) :')
for (const j of [...m.joueurs].sort((a, b) => b.total - a.total)) console.log(`  ${j.nom.padEnd(11)} ${abrege(j.total).padStart(9)}  couleur ${LETTRES_COULEUR[couleurDominanteDe(j)]}  ${resume(m, j)}`)
const modules = m.joueurs.flatMap((j) => j.modules)
const branches = modules.filter((mo) => mo.parent !== null).length
console.log(`\nmodules existants : ${modules.length}, branchés ${branches} (${Math.round((100 * branches) / Math.max(1, modules.length))} %) ; par rareté ${RARETES.noms.map((n, r) => `${n} ${modules.filter((mo) => mo.rarete === r).length}`).join(', ')}`)
console.log(`par sorte : ${Array.from({ length: SORTES }, (_, s) => [s, modules.filter((mo) => sorteDe(mo.couleur, mo.forme) === s).length] as const).filter(([, n]) => n > 0).map(([s, n]) => `${code(s)} ${n}`).join(', ')}`)
const generateurs = m.joueurs.flatMap((j) => j.producteurs)
console.log(`générateurs : ${['source', 'raffinerie', 'melangeur'].map((g) => `${g} ${generateurs.filter((p) => genreDe(p) === g).length}`).join(', ')} ; niveaux de source ${generateurs.filter((p) => genreDe(p) === 'source').reduce((s, p) => s + p.niveau - 1, 0)}`)
console.log(`fabrications : ${m.joueurs.reduce((s, j) => s + j.journal.fabrications, 0)}, fusions : ${m.joueurs.reduce((s, j) => s + j.journal.fusions, 0)}, ventes : ${abrege(m.joueurs.reduce((s, j) => s + j.journal.orVentes, 0))} or, achats : ${abrege(m.joueurs.reduce((s, j) => s + j.journal.orAchats, 0))} or`)
