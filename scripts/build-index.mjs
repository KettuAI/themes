// Checks every theme in themes/, formats it, and writes index.json, the catalog OverBench reads.
// Usage: node scripts/build-index.mjs [--check]
//   --check writes nothing and fails when a theme is invalid or unformatted, or index.json is stale.
// The theme checks are OverBench's own (src/shared/themes.ts in overbench/overbench), plus the
// catalog's: an author, a version and a license, and nothing in a file that OverBench would ignore.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const THEMES_DIR = 'themes'
const INDEX_FILE = 'index.json'
const CATALOG_FORMAT = 1
const THEME_FORMAT = 1
const MAX_BYTES = 256 * 1024
const MODES = ['light', 'dark']

const TOKENS = new Set([
  'bg-app',
  'bg-sidebar',
  'bg-surface',
  'bg-subtle',
  'bg-code-inline',
  'bg-code-block',
  'bg-hover',
  'bg-selected',
  'queue-back',
  'border-default',
  'border-subtle',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-placeholder',
  'text-disabled',
  'icon-default',
  'attention',
  'attention-dot',
  'danger',
  'success',
  'merged',
  'info',
  'warning',
  'link',
  'link-hover',
  'danger-tint',
  'danger-border',
  'success-tint',
  'info-tint',
  'warning-tint',
  'info-tint-hover',
  'focus',
  'selection',
  'edit-ring',
  'edit-selection',
  'primary-from',
  'primary-to',
  'primary-hover-from',
  'primary-hover-to',
  'primary-ring',
  'primary-highlight',
  'primary-foreground',
  'scrollbar-thumb',
  'scrim',
  'viewer-scrim',
  'mark',
  'checker',
  'agent-opencode',
  'agent-other',
  'heat-hue',
  'heat-0',
  'context-1',
  'context-2',
  'context-3',
  'context-4',
  'context-5',
  'context-6',
  'context-7',
  'terminal-background',
  'terminal-foreground',
  'terminal-cursor',
  'terminal-selection',
  'ansi-black',
  'ansi-red',
  'ansi-green',
  'ansi-yellow',
  'ansi-blue',
  'ansi-magenta',
  'ansi-cyan',
  'ansi-white',
  'ansi-bright-black',
  'ansi-bright-red',
  'ansi-bright-green',
  'ansi-bright-yellow',
  'ansi-bright-blue',
  'ansi-bright-magenta',
  'ansi-bright-cyan',
  'ansi-bright-white',
])

// The tokens a theme's tile in OverBench draws, so the app can show it before downloading it.
const PREVIEW_TOKENS = [
  'bg-app',
  'bg-sidebar',
  'bg-surface',
  'bg-subtle',
  'bg-selected',
  'border-default',
  'border-subtle',
  'border-strong',
  'primary-from',
  'primary-to',
]

const FIELDS = ['overbenchTheme', 'name', 'author', 'version', 'license', 'source', 'light', 'dark']
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const CODE_THEME = /^[a-z0-9-]{1,64}$/
const CONTROL = /[\u0000-\u001f\u007f]/

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A string of 1 to `max` characters, without control characters or spaces around it. */
const isText = (value, max) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  value === value.trim() &&
  !CONTROL.test(value)

/** OverBench's id for a name: lowercase ASCII letters and digits, each other run a dash. */
function themeId(name) {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return slug || `theme-${createHash('sha256').update(name).digest('hex').slice(0, 8)}`
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/

/** One component: a number with an optional unit, or `none`. */
function component(part) {
  if (part === 'none') return { value: 0, unit: '' }
  const number = NUMBER.exec(part)?.[0]
  if (number === undefined) return null
  const unit = part.slice(number.length)
  if (!['', '%', 'deg', 'rad', 'grad', 'turn'].includes(unit)) return null
  return Number.isFinite(Number(number)) ? { unit } : null
}

const isAmount = (part) => !!part && (part.unit === '' || part.unit === '%')
const isHue = (part) => !!part && part.unit !== '%'

/** Whether OverBench reads `value` as a color: hex, rgb(), hsl(), oklch(), oklab() or transparent. */
function isColor(value) {
  const source = value.trim().toLowerCase()
  if (source === 'transparent') return true
  if (/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(source)) return true
  const call = /^(rgba?|hsla?|oklch|oklab)\(([\d\sa-z.%+,/-]*)\)$/.exec(source)
  if (!call) return false
  const [, name, args = ''] = call
  let parts
  let alpha
  if (args.includes(',')) {
    if (args.includes('/')) return false
    parts = args.split(',').map((part) => part.trim())
    if (parts.length === 4) alpha = parts.pop()
  } else {
    const [main = '', slashed, extra] = args.split('/')
    if (extra !== undefined) return false
    parts = main.trim().split(/\s+/)
    alpha = slashed?.trim()
  }
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return false
  if (alpha !== undefined && !isAmount(component(alpha))) return false
  const [x, y, z] = parts.map(component)
  if (name.startsWith('hsl')) return isHue(x) && isAmount(y) && isAmount(z)
  if (name === 'oklch') return isAmount(x) && isAmount(y) && isHue(z)
  return isAmount(x) && isAmount(y) && isAmount(z)
}

/** Checks one theme file's parsed JSON; answers with its index entry or throws its first problem. */
function checkTheme(fileName, raw) {
  if (!isRecord(raw)) throw new Error('is not a JSON object')
  if (raw.overbenchTheme !== THEME_FORMAT) throw new Error(`needs "overbenchTheme": ${THEME_FORMAT}`)
  const unknown = Object.keys(raw).find((key) => !FIELDS.includes(key))
  if (unknown !== undefined) throw new Error(`has a field OverBench does not read: ${unknown}`)

  if (!isText(raw.name, 64)) throw new Error('needs a name of 1 to 64 characters')
  const id = themeId(raw.name)
  if (id === 'overbench') throw new Error("takes the built-in theme's name")
  if (fileName !== `${id}.json`) throw new Error(`should be named ${id}.json, after its name`)
  if (!isText(raw.author, 100)) throw new Error('needs an author')
  if (!isText(raw.version, 32) || !VERSION.test(raw.version)) {
    throw new Error('needs a version, such as 1.0.0')
  }
  if (!isText(raw.license, 64)) throw new Error('needs a license, such as MIT')
  const source = typeof raw.source === 'string' ? URL.parse(raw.source) : null
  if (raw.source !== undefined && source?.protocol !== 'https:') {
    throw new Error('has a source that is not an https URL')
  }

  const preview = {}
  for (const mode of MODES) {
    const variant = raw[mode]
    if (!isRecord(variant)) throw new Error(`needs a ${mode} variant`)
    const extra = Object.keys(variant).find((key) => key !== 'colors' && key !== 'code')
    if (extra !== undefined) throw new Error(`has a field OverBench does not read: ${mode}.${extra}`)
    const code = variant.code
    if (code !== undefined && (typeof code !== 'string' || !CODE_THEME.test(code))) {
      throw new Error(`${mode}.code is not a Shiki theme id`)
    }
    const colors = variant.colors ?? {}
    if (!isRecord(colors)) throw new Error(`${mode}.colors is not an object`)
    for (const [token, value] of Object.entries(colors)) {
      const path = `${mode}.colors.${token}`
      if (!TOKENS.has(token)) throw new Error(`${path} is not a token OverBench knows`)
      if (!isText(value, 100) || !isColor(value)) throw new Error(`${path} is not a color`)
    }
    const shown = PREVIEW_TOKENS.filter((token) => Object.hasOwn(colors, token))
    preview[mode] = Object.fromEntries(shown.map((token) => [token, colors[token]]))
  }

  return {
    id,
    name: raw.name,
    author: raw.author,
    version: raw.version,
    license: raw.license,
    file: `${THEMES_DIR}/${fileName}`,
    preview,
  }
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  console.error('Usage: node scripts/build-index.mjs [--check]')
  process.exit(2)
}
const check = args[0] === '--check'

const problems = []
const themes = []
for (const fileName of readdirSync(join(ROOT, THEMES_DIR)).sort()) {
  const path = join(ROOT, THEMES_DIR, fileName)
  try {
    if (!fileName.endsWith('.json')) throw new Error('is not a .json file')
    let bytes = readFileSync(path)
    if (bytes.length > MAX_BYTES) throw new Error(`is larger than ${MAX_BYTES / 1024} KB`)
    let raw
    try {
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      throw new Error('is not UTF-8 JSON')
    }
    const entry = checkTheme(fileName, raw)
    // Two spaces, LF and a final newline, so the bytes OverBench downloads match their hash here.
    const formatted = Buffer.from(`${JSON.stringify(raw, null, 2)}\n`)
    if (!formatted.equals(bytes)) {
      if (check) throw new Error('is not formatted; run node scripts/build-index.mjs')
      writeFileSync(path, formatted)
      bytes = formatted
    }
    const { preview, ...fields } = entry
    themes.push({ ...fields, sha256: createHash('sha256').update(bytes).digest('hex'), preview })
  } catch (error) {
    problems.push(`${THEMES_DIR}/${fileName} ${error.message}`)
  }
}

const index = `${JSON.stringify({ overbenchCatalog: CATALOG_FORMAT, themes }, null, 2)}\n`
if (problems.length === 0 && check) {
  let current = null
  try {
    current = readFileSync(join(ROOT, INDEX_FILE), 'utf8')
  } catch {
    // A missing index is out of date too.
  }
  if (current !== index) problems.push(`${INDEX_FILE} is out of date; run node scripts/build-index.mjs`)
}
if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
if (!check) writeFileSync(join(ROOT, INDEX_FILE), index)
console.log(`${check ? 'Checked' : 'Wrote'} ${INDEX_FILE}: ${themes.length} themes`)
