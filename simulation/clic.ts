/**
 * UNE SAISON DU SYSTÈME ABSTRAIT : huit bots, sept jours. On mesure ce que
 * les chiffres de `logic/clic/donnees.ts` produisent avant de les servir à des
 * amis : l'ordre de grandeur gagné par jour, le prix du marché, les prestiges.
 * `node simulation/clic.ts [graine] [--suivre=Nom] [--csv]`.
 */
import { ACHAT, EFFETS, NIVEAU, PRESTIGE, PRODUCTEURS, SAISON_H } from '../src/logic/clic/donnees.ts'
import { avancer, debit, modulesDe, nouveauMonde, prixCourant, type Joueur, type Monde } from '../src/logic/clic/moteur.ts'
import { visiter } from '../src/logic/clic/bots.ts'
import { BOTS, PAS } from '../src/logic/clic/partie.ts'
import { graineDe, rngDe } from '../src/logic/rng.ts'

const args = process.argv.slice(2)
const graine = Number(args.find((a) => /^\d+$/.test(a)) ?? '1')
const suivre = args.find((a) => a.startsWith('--suivre='))?.slice(9)
const csv = args.includes('--csv')

// LE BALAYAGE : des variables d'environnement pour essayer d'autres chiffres sans toucher aux données.
// `QC_LOT=0.5` divise tous les lots par deux ; `QC_BASE=1e7` la base du prestige ; `QC_PAR=0.5` l'effet d'un point.
const echelleLot = Number(process.env.QC_LOT ?? '1')
for (const p of PRODUCTEURS) (p as { lot: number }).lot *= echelleLot
// `QC_COUT=15` : chaque producteur coûte 15 fois le précédent (A garde son prix).
if (process.env.QC_COUT !== undefined) PRODUCTEURS.forEach((p, i) => { if (i > 1) (p as { cout: number }).cout = (PRODUCTEURS[1]?.cout ?? 100) * Math.pow(Number(process.env.QC_COUT), i - 1) })
// `QC_TIER=4` : le lot de chaque producteur vaut 4 fois le précédent (la base garde le sien), quels que soient les lots écrits.
if (process.env.QC_TIER !== undefined) PRODUCTEURS.forEach((p, i) => { if (i > 0) (p as { lot: number }).lot = Math.round((PRODUCTEURS[0]?.lot ?? 1) * Math.pow(Number(process.env.QC_TIER), i)) })
if (process.env.QC_BASE !== undefined) (PRESTIGE as { base: number }).base = Number(process.env.QC_BASE)
if (process.env.QC_PAR !== undefined) (PRESTIGE as { parPoint: number }).parPoint = Number(process.env.QC_PAR)
// `QC_PREMIER=0.5` le premier niveau en part du prix ; `QC_NIV=1.25` la croissance d'un niveau ; `QC_PIECE=3` celle d'une pièce de plus ; `QC_PERIODE=5` la période de l'horloge.
if (process.env.QC_PREMIER !== undefined) (NIVEAU as { premier: number }).premier = Number(process.env.QC_PREMIER)
if (process.env.QC_NIV !== undefined) (NIVEAU as { croissance: number }).croissance = Number(process.env.QC_NIV)
if (process.env.QC_PIECE !== undefined) (ACHAT as { croissance: number }).croissance = Number(process.env.QC_PIECE)
if (process.env.QC_PERIODE !== undefined) (EFFETS as { periode: number }).periode = Number(process.env.QC_PERIODE)
// `QC_AJOUT=0.5`, `QC_MULT=0.5`, `QC_CRIT=0.1` : la force des effets au niveau 1.
if (process.env.QC_AJOUT !== undefined) (EFFETS as { ajout: number }).ajout = Number(process.env.QC_AJOUT)
if (process.env.QC_MULT !== undefined) (EFFETS as { multiplicateur: number }).multiplicateur = Number(process.env.QC_MULT)
if (process.env.QC_CRIT !== undefined) (EFFETS as { critique: number }).critique = Number(process.env.QC_CRIT)

/** Le premier joueur joue comme un humain assidu : quatre visites, cent tapes. */
const JOUEURS = [{ nom: 'Keko', tapes: 100, seuilPrestige: 2, visites: 4 }, ...BOTS]

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

/** Les producteurs avec leurs modules : « B[H12 A8 M5] » = un B qui porte une horloge niveau 12, un ajout niveau 8, un multiplicateur niveau 5. */
function resume(j: Joueur): string {
  const lettres = 'HAMC'
  const prods = j.producteurs
    .map((p) => `${(PRODUCTEURS[p.type]?.id ?? '?').toUpperCase()}[${modulesDe(j, p).map((mo) => `${lettres[mo.type]}${mo.niveau}`).join(' ')}]`)
    .join(' ')
  const poses = j.modules.filter((mo) => mo.parent === null).length
  return `R ${abrege(j.r)} or ${abrege(j.or)} | ${abrege(debit(j))}/s | ${prods}${poses > 0 ? ` +${poses} posés` : ''}${j.auto ? ' auto' : ''} | pts ${j.points} (×${j.prestiges}) | total ${abrege(j.total)}`
}

export function jouerSaison(): Monde {
  const m = nouveauMonde(JOUEURS.map((s) => s.nom))
  const visites: { t: number; bot: number }[] = []
  JOUEURS.forEach((s, bot) => {
    for (let jour = 0; jour < 7; jour++) {
      const rng = rngDe(graineDe(graine, bot + 1, jour + 1))
      for (let k = 0; k < s.visites; k++) visites.push({ t: 24 * jour + (16 * (k + rng())) / s.visites, bot })
    }
  })
  visites.sort((a, b) => a.t - b.t)
  const prixDuJour: number[] = []
  let i = 0
  const lignes: string[] = []
  while (m.t < SAISON_H - 1e-9) {
    while (i < visites.length && visites[i]!.t < m.t + PAS) {
      const v = visites[i]!
      const j = m.joueurs[v.bot]!
      const avant = suivre === j.nom ? resume(j) : ''
      visiter(m, j, JOUEURS[v.bot]!)
      if (suivre === j.nom) console.log(`  ${(v.t / 24).toFixed(2)} j  ${avant}\n          → ${resume(j)}  prix ${prixCourant(m).toFixed(3)}`)
      i++
    }
    avancer(m, PAS)
    prixDuJour.push(prixCourant(m))
    if (Math.abs(m.t - Math.round(m.t)) < 1e-6 && Math.round(m.t) % 24 === 0) {
      const jour = Math.round(m.t) / 24
      const totaux = m.joueurs.map((j) => j.total).sort((a, b) => a - b)
      const median = totaux[Math.floor(totaux.length / 2)]!
      const prix = [...prixDuJour].sort((a, b) => a - b)
      const keko = m.joueurs[0]!
      lignes.push(
        csv
          ? [jour, median, totaux[0], totaux[totaux.length - 1], prix[0], prix[Math.floor(prix.length / 2)], prix[prix.length - 1]].join(';')
          : `jour ${jour} | total médian ${abrege(median)} (min ${abrege(totaux[0]!)}, max ${abrege(totaux[totaux.length - 1]!)}) | prix ${prix[0]!.toFixed(2)} / ${prix[Math.floor(prix.length / 2)]!.toFixed(2)} / ${prix[prix.length - 1]!.toFixed(2)} | Keko : ${resume(keko)}`,
      )
      prixDuJour.length = 0
    }
  }
  for (const l of lignes) console.log(l)
  return m
}

const m = jouerSaison()
console.log('\nclassement final (total produit) :')
for (const j of [...m.joueurs].sort((a, b) => b.total - a.total)) console.log(`  ${j.nom.padEnd(11)} ${abrege(j.total).padStart(9)}  ${resume(j)}`)
