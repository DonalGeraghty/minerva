import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const distDirectory = new URL('../dist/', import.meta.url)
const forbiddenProductionText = [
  'demo@minerva.local',
  'minerva-demo-session',
  'minerva-demo-account',
  'minerva-demo',
]

async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name, directory)
    return entry.isDirectory() ? filesWithin(new URL(`${entry.name}/`, directory)) : [target]
  }))
  return files.flat()
}

const files = await filesWithin(distDirectory)
const scripts = files.filter((file) => file.pathname.endsWith('.js'))
const scriptText = (await Promise.all(scripts.map((file) => readFile(file, 'utf8')))).join('\n')

for (const marker of forbiddenProductionText) {
  if (scriptText.includes(marker)) throw new Error(`Production bundle contains dev marker: ${marker}`)
}

const assetBudgets = new Map([
  ['minerva-favicon-32.png', 100_000],
  ['apple-touch-icon.png', 300_000],
  ['minerva-192.png', 300_000],
  ['minerva-512.png', 1_000_000],
  ['minerva-maskable-512.png', 1_000_000],
  ['manifest.webmanifest', 10_000],
  ['og.png', 3_000_000],
])

for (const [name, maximumBytes] of assetBudgets) {
  const asset = files.find((file) => path.basename(file.pathname) === name)
  if (!asset) throw new Error(`Production asset is missing: ${name}`)
  const details = await stat(asset)
  if (details.size > maximumBytes) {
    throw new Error(`${name} is ${details.size} bytes; budget is ${maximumBytes}`)
  }
}

console.log('Production bundle checks passed')
