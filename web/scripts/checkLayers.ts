// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Architecture guard (runs in `npm run build`): fails if a layer imports what it must not.
//   shared/  imports nothing outside shared/
//   server/  never imports src/
//   src/     never imports server/ or Node built-ins
//   views    (src/components, src/App.tsx) never call fetch() nor import the API client: they use hooks/services

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : filesUnder(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

function layerOf(path: string): string {
  return relative(ROOT, path).split(sep)[0]
}

const problems: string[] = []
for (const layer of ['shared', 'server', 'src']) {
  for (const file of filesUnder(join(ROOT, layer))) {
    const code = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file).split(sep).join('/')
    const isView = rel.startsWith('src/components/') || rel === 'src/App.tsx'
    for (const match of code.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2]
      const target = spec.startsWith('.') ? layerOf(resolve(dirname(file), spec)) : null
      if (layer === 'shared' && (target !== null ? target !== 'shared' : true)) problems.push(`${rel}: shared/ must not import "${spec}"`)
      if (layer === 'server' && target === 'src') problems.push(`${rel}: server/ must not import the frontend ("${spec}")`)
      if (layer === 'src' && target === 'server') problems.push(`${rel}: the frontend must not import server/ ("${spec}")`)
      if (layer === 'src' && /^(node:|fs$|path$)/.test(spec)) problems.push(`${rel}: the frontend must not import Node built-ins ("${spec}")`)
      if (isView && /services\/apiClient/.test(spec)) problems.push(`${rel}: views must use hooks/services, not the API client`)
    }
    if (isView && /\bfetch\s*\(/.test(code)) problems.push(`${rel}: views must not call fetch(); use src/services`)
  }
}

if (problems.length > 0) {
  console.error(`Layer check failed (${problems.length}):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('Layer check passed: shared/, server/ and src/ respect their boundaries.')
