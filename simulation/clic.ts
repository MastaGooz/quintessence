/**
 * UNE SAISON DU SYSTÈME ABSTRAIT : huit joueurs simulés, sept jours, un
 * marché commun. On mesure ce que les chiffres de `logic/clic/donnees.ts`
 * produisent avant de les servir à des amis : l'ordre de grandeur gagné par
 * jour, les prix des quatre sortes, les modules fabriqués par rareté, la part
 * branchée, les prestiges.
 * `node simulation/clic.ts [graine] [--suivre=Nom] [--csv]`.
 */
import { ACHAT, ATELIERS, EFFETS, FORMES, MARCHE, NIVEAU, PRESTIGE, RARETES, SAISON_H, SOURCES } from '../src/logic/clic/donnees.ts'
import { avancer, debit, estAtelier, modulesDe, nouveauMonde, prixCourant, soute, typeDe, type Joueur, type Monde } from '../src/logic/clic/moteur.ts'
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
// `QC_COUT=15` : chaque source coûte 15 fois la précédente (A garde son prix) ; `QC_TIER=4` : le lot de chaque source vaut 4 fois la précédente.
if (process.env.QC_COUT !== undefined) SOURCES.forEach((p, i) => { if (i > 1) (p as { cout: number }).cout = (SOURCES[1]?.cout ?? 100) * Math.pow(Number(process.env.QC_COUT), i - 1) })
if (process.env.QC_TIER !== undefined) SOURCES.forEach((p, i) => { if (i > 0) (p as { lot: number }).lot = Math.round((SOURCES[0]?.lot ?? 1) * Math.pow(Number(process.env.QC_TIER), i)) })
if (process.env.QC_BASE !== undefined) (PRESTIGE as { base: number }).base = Number(process.env.QC_BASE)
if (process.env.QC_PAR !== undefined) (PRESTIGE as { parPoint: number }).parPoint = Number(process.env.QC_PAR)
// `QC_PREMIER=0.5` le premier niveau en part de la valeur ; `QC_NIV=1.25` la croissance d'un niveau ; `QC_PIECE=3` celle d'une pièce de plus ; `QC_PERIODE=5` la période de l'horloge.
if (process.env.QC_PREMIER !== undefined) (NIVEAU as { premier: number }).premier = Number(process.env.QC_PREMIER)
if (process.env.QC_NIV !== undefined) (NIVEAU as { croissance: number }).croissance = Number(process.env.QC_NIV)
if (process.env.QC_PIECE !== undefined) (ACHAT as { croissance: number }).croissance = Number(process.env.QC_PIECE)
if (process.env.QC_PERIODE !== undefined) (EFFETS as { periode: number }).periode = Number(process.env.QC_PERIODE)
if (process.env.QC_AJOUT !== undefined) (EFFETS as { ajout: number }).ajout = Number(process.env.QC_AJOUT)
if (process.env.QC_MULT !== undefined) (EFFETS as { multiplicateur: number }).multiplicateur = Number(process.env.QC_MULT)
if (process.env.QC_CRIT !== undefined) (EFFETS as { critique: number }).critique = Number(process.env.QC_CRIT)
// LES ATELIERS : `QC_ENTREE=0.5` divise le plancher de matière par fournée par deux ; `QC_DUREE=0.5` divise le temps de production par fournée par deux ; `QC_ATELIER=0.5` divise leur prix par deux.
if (process.env.QC_ENTREE !== undefined) for (const a of ATELIERS) (a as { entree: number }).entree *= Number(process.env.QC_ENTREE)
if (process.env.QC_DUREE !== undefined) for (const a of ATELIERS) (a as { duree: number }).duree *= Number(process.env.QC_DUREE)
if (process.env.QC_ATELIER !== undefined) for (const a of ATELIERS) (a as { cout: number }).cout *= Number(process.env.QC_ATELIER)
// LE MARCHÉ : `QC_DEMANDE=200` la demande minimale, `QC_TAMPON=2` les heures de production qui font la demande, `QC_DEMIVIE=2`.
if (process.env.QC_DEMANDE !== undefined) (MARCHE as { demandeMin: number }).demandeMin = Number(process.env.QC_DEMANDE)
if (process.env.QC_TAMPON !== undefined) (MARCHE as { tampon: number }).tampon = Number(process.env.QC_TAMPON)
if (process.env.QC_DEMIVIE !== undefined) (MARCHE as { demiVie: number }).demiVie = Number(process.env.QC_DEMIVIE)
// LES RARETÉS : `QC_RARETE=1,1.5,2.5,4,7` les multiplicateurs d'effet.
if (process.env.QC_RARETE !== undefined) (RARETES as { effet: number[] }).effet = process.env.QC_RARETE.split(',').map(Number)

/** Le premier joueur joue comme un humain assidu : quatre visites, cent tapes, la matière ronde. */
const JOUEURS = [{ nom: 'Keko', tapes: 100, seuilPrestige: 2, visites: 4, sorte: 0 }, ...BOTS]

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
const LETTRES_FORME = 'HAMC'

/** Les générateurs avec leurs modules : « B[H12r A8 M5E] » = un B qui porte une horloge niveau 12 rare, un ajout niveau 8 commun, un multiplicateur niveau 5 épique ; un atelier « T1→H ». */
function resume(m: Monde, j: Joueur): string {
  const prods = j.producteurs
    .map((p) => {
      const t = typeDe(p)
      const mods = modulesDe(j, p).map((mo) => `${LETTRES_FORME[mo.type]}${mo.niveau}${mo.rarete > 0 ? LETTRES_RARETE[mo.rarete] : ''}`).join(' ')
      return `${estAtelier(p) ? `T${t.id.slice(1)}→${LETTRES_FORME[p.forme]}` : t.id.toUpperCase()}[${mods}]`
    })
    .join(' ')
  const s = soute(j)
  const stock = j.matiere.map((q, k) => `${LETTRES_FORME[k]}${abrege(q)}`).join(' ')
  const raretes = RARETES.noms.map((_, r) => j.modules.filter((mo) => mo.rarete === r).length).join('/')
  return `${abrege(j.or)} or | ${abrege(debit(j))}/s | stock ${stock} | ${prods}${s.length > 0 ? ` +${s.length} en soute` : ''} | modules c/p/r/E/L ${raretes} | fournées ${j.journal.fournees}, fusions ${j.journal.fusions} | pts ${j.points} (×${j.prestiges}) | total ${abrege(j.total)}`
}

function prix(m: Monde): string {
  return Array.from({ length: FORMES }, (_, s) => `${LETTRES_FORME[s]} ${prixCourant(m, s).toFixed(2)}`).join(' ')
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
          : `jour ${jour} | total médian ${abrege(median)} (min ${abrege(totaux[0]!)}, max ${abrege(totaux[totaux.length - 1]!)}) | prix ${prix(m)} | Keko : ${resume(m, keko)}`,
      )
    }
  }
  for (const l of lignes) console.log(l)
  return m
}

const m = jouerSaison()
console.log('\nclassement final (total produit) :')
for (const j of [...m.joueurs].sort((a, b) => b.total - a.total)) console.log(`  ${j.nom.padEnd(11)} ${abrege(j.total).padStart(9)}  sorte ${LETTRES_FORME[j.sorte ?? 0]}  ${resume(m, j)}`)
const modules = m.joueurs.flatMap((j) => j.modules)
const branches = modules.filter((mo) => mo.parent !== null).length
console.log(`\nmodules existants : ${modules.length}, branchés ${branches} (${Math.round((100 * branches) / Math.max(1, modules.length))} %) ; par rareté ${RARETES.noms.map((n, r) => `${n} ${modules.filter((mo) => mo.rarete === r).length}`).join(', ')}`)
console.log(`fournées : ${m.joueurs.reduce((s, j) => s + j.journal.fournees, 0)}, fusions : ${m.joueurs.reduce((s, j) => s + j.journal.fusions, 0)}, ventes : ${abrege(m.joueurs.reduce((s, j) => s + j.journal.orVentes, 0))} or, achats : ${abrege(m.joueurs.reduce((s, j) => s + j.journal.orAchats, 0))} or`)
