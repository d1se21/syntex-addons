// Builds index.json, the list of the catalog that Syntex reads, from the add-on folders here.
// Each folder with a manifest.json and a main.js is an add-on; run `node build-index.mjs` after adding or changing one.
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const FILES = ['manifest.json', 'main.js', 'styles.css']
const addons = []
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name.startsWith('.')) continue
  const folder = join(root, dir.name)
  if (!existsSync(join(folder, 'manifest.json')) || !existsSync(join(folder, 'main.js'))) continue
  const m = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''))
  if (!m.id || !m.name || !m.version) throw new Error(`${dir.name}/manifest.json needs id, name and version`)
  addons.push({
    id: m.id,
    name: m.name,
    ...(m.description ? { description: m.description } : {}),
    version: m.version,
    ...(m.author ? { author: m.author } : {}),
    // an older Syntex shows that the add-on needs a newer one, instead of installing what it cannot run
    ...(m.minApi ? { minApi: m.minApi } : {}),
    // what it asks for (the microphone): the catalog shows it before it is installed
    ...(Array.isArray(m.permissions) && m.permissions.length ? { permissions: m.permissions } : {}),
    path: dir.name,
    files: FILES.filter((f) => existsSync(join(folder, f))),
    // what Syntex checks a download against (the text as it is read: utf-8)
    hashes: Object.fromEntries(FILES.filter((f) => existsSync(join(folder, f))).map((f) => [f, createHash('sha256').update(readFileSync(join(folder, f), 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex')]))
  })
}
addons.sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(join(root, 'index.json'), JSON.stringify({ addons }, null, 2) + '\n')
console.log(`index.json: ${addons.length} add-on(s)`)
