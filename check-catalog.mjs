// The check before the catalog is published (git push): run `node check-catalog.mjs`; it ends with an error when
// what would go out is wrong. It reads what is committed (HEAD), not the working folder, since only that is pushed:
//  - index.json of HEAD is the one built from the add-on files of HEAD (ids, versions, files, hashes);
//  - an add-on whose files changed since the catalog on GitHub (origin/main) has a higher version than there
//    (else installed copies never hear of the change), and no version goes down;
// and it warns about changes in the folder that are not committed (they would not go out with the push).
// `node check-catalog.mjs <ref>` checks another commit instead of HEAD.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ref = process.argv[2] || 'HEAD'
const base = 'origin/main'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const show = (r, path) => {
  try {
    return git('show', `${r}:${path}`)
  } catch {
    return null
  }
}
const FILES = ['manifest.json', 'main.js', 'styles.css']
const problems = []
const warnings = []

/** The index as build-index.mjs makes it, from the files of a commit. */
function indexOf(r) {
  const paths = git('ls-tree', '-r', '--name-only', r).split('\n').filter(Boolean)
  const folders = [...new Set(paths.filter((p) => /^[^/]+\/manifest\.json$/.test(p)).map((p) => p.split('/')[0]))].filter((d) => !d.startsWith('.') && paths.includes(`${d}/main.js`))
  const addons = []
  for (const dir of folders) {
    const m = JSON.parse(show(r, `${dir}/manifest.json`).replace(/^﻿/, ''))
    const files = FILES.filter((f) => paths.includes(`${dir}/${f}`))
    addons.push({
      id: m.id,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
      version: m.version,
      ...(m.author ? { author: m.author } : {}),
      ...(m.minApi ? { minApi: m.minApi } : {}),
      ...(Array.isArray(m.permissions) && m.permissions.length ? { permissions: m.permissions } : {}),
      path: dir,
      files,
      hashes: Object.fromEntries(files.map((f) => [f, createHash('sha256').update(show(r, `${dir}/${f}`).replace(/\r\n/g, '\n'), 'utf8').digest('hex')]))
    })
  }
  addons.sort((a, b) => a.id.localeCompare(b.id))
  return { addons }
}

const newer = (a, b) => {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

// 1. the committed index is the one its files make
const built = indexOf(ref)
const committed = JSON.parse(show(ref, 'index.json') ?? '{"addons":[]}')
const byId = (list) => Object.fromEntries(list.addons.map((a) => [a.id, a]))
const want = byId(built)
const have = byId(committed)
for (const id of new Set([...Object.keys(want), ...Object.keys(have)])) {
  if (!have[id]) problems.push(`index.json has no "${id}" (its folder is in the commit): run node build-index.mjs and commit`)
  else if (!want[id]) problems.push(`index.json lists "${id}", which has no folder in the commit`)
  else if (JSON.stringify(have[id]) !== JSON.stringify(want[id])) {
    const what = ['version', 'hashes', 'files', 'minApi', 'permissions', 'name', 'description'].filter((k) => JSON.stringify(have[id][k]) !== JSON.stringify(want[id][k]))
    problems.push(`index.json is not built from the files of "${id}" (${what.join(', ')} differ): run node build-index.mjs and commit`)
  }
}

// 2. versions against the catalog on GitHub
let published = null
try {
  git('rev-parse', '--verify', '--quiet', base)
  published = byId(indexOf(base))
} catch {
  warnings.push(`no ${base} here (git fetch first): the versions are not compared with GitHub`)
}
if (published) {
  for (const [id, a] of Object.entries(want)) {
    const p = published[id]
    if (!p) continue
    const changed = JSON.stringify(p.hashes) !== JSON.stringify(a.hashes)
    if (newer(p.version, a.version)) problems.push(`"${id}" ${a.version} is older than the published ${p.version}`)
    else if (changed && !newer(a.version, p.version)) problems.push(`"${id}" changed since the catalog on GitHub but is still ${a.version}: raise its version`)
  }
}

// 3. what is not committed does not go out
const dirty = git('status', '--porcelain').split('\n').filter(Boolean)
if (dirty.length) warnings.push(`not committed, so not published: ${dirty.map((l) => l.slice(3)).join(', ')}`)

for (const w of warnings) console.log('warning: ' + w)
for (const p of problems) console.log('PROBLEM: ' + p)
if (problems.length) {
  console.log(`\nThe catalog is not ready to be published (${problems.length} problem(s)).`)
  process.exit(1)
}
const changes = published ? Object.values(want).filter((a) => !published[a.id] || published[a.id].version !== a.version) : []
console.log(`The catalog of ${ref} is ready: ${built.addons.length} add-ons${changes.length ? '; new on publishing: ' + changes.map((a) => `${a.id} ${a.version}`).join(', ') : ', nothing new against GitHub'}.`)
