// Pixel art for the library: a 5x7 bitmap font and the SVG pieces the pane
// draws (sign, books, shelf planks, open-book pages). Every drawing works on
// a coarse unit grid and is scaled up with crisp edges, so it reads as pixels.

export const PALETTE = {
  night: '#1b1424',
  woodDark: '#3d2314',
  wood: '#6e4122',
  woodLight: '#9a5f2e',
  woodShine: '#c88a4a',
  paper: '#f3e3c0',
  paperShade: '#dcc59a',
  ink: '#3a2817',
  leather: '#6b2a20',
  leatherDark: '#42160f',
  gold: '#e9b44c',
  goldDark: '#a8742a',
  cream: '#fff4d6',
}


// 5x7 glyphs, one 5-bit row per entry, top to bottom.
const GLYPHS: Record<string, readonly number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '/': [0, 1, 2, 4, 8, 16, 0],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  "'": [12, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '*': [0, 4, 21, 14, 21, 4, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '%': [24, 25, 2, 4, 8, 19, 3],
  '~': [0, 0, 8, 21, 2, 0, 0],
}

const UNKNOWN = [31, 17, 17, 17, 17, 17, 31]

/** Width in units of `text` drawn at `scale`, one blank column between glyphs. */
export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * 6 - 1) * scale
}

/** One `<path>` of square pixels spelling `text` from its top-left corner. */
export function pixelText(text: string, x: number, y: number, scale: number, fill: string): string {
  let d = ''
  let cx = x
  for (const raw of text.toUpperCase()) {
    const rows = GLYPHS[raw] ?? UNKNOWN
    rows.forEach((bits, row) => {
      for (let col = 0; col < 5; col++) {
        if (bits & (16 >> col)) {
          d += `M${cx + col * scale} ${y + row * scale}h${scale}v${scale}h-${scale}z`
        }
      }
    })
    cx += 6 * scale
  }
  return d === '' ? '' : `<path d="${d}" fill="${fill}"/>`
}

/** Breaks `text` into at most `maxLines` lines of `perLine` characters. */
export function wrapWords(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const piece = word.length > perLine ? word.slice(0, perLine) : word
    if (line === '') line = piece
    else if (line.length + 1 + piece.length <= perLine) line += ' ' + piece
    else {
      lines.push(line)
      line = piece
    }
    if (lines.length === maxLines) break
  }
  if (line !== '' && lines.length < maxLines) lines.push(line)
  return lines
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function svg(w: number, h: number, body: string, scale: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${body}</svg>`
}

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
}

/** The stone wall behind everything, brick by brick. */
function stoneWall(w: number, h: number): string {
  let body = rect(0, 0, w, h, '#1d1922')
  for (let row = 0; row * 7 < h; row++) {
    const offset = row % 2 === 0 ? 0 : 8
    for (let col = -1; col * 16 < w; col++) {
      const bx = col * 16 + offset
      const tone = ['#2c2733', '#29242f', '#312b38', '#272230'][(row * 7 + col * 3) % 4] ?? '#2c2733'
      body += rect(bx + 1, row * 7 + 1, 15, 6, tone)
      body += rect(bx + 1, row * 7 + 1, 15, 1, 'rgba(255,255,255,0.04)')
    }
  }
  return body
}

/** An SVG that fills the width it is given, its height following its own proportions. */
function wideSvg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">${body}</svg>`
}

export const CASE = { stone: '#1d1922', post: '#3d2314', back: '#20120a' }

const SPINES = ['#8e2a2a', '#2b4f7a', '#3d6e6a', '#7a4a28', '#b0582a', '#d6c59a', '#2f5a3a', '#5a2a4a', '#34405e', '#a8323a']

/** The height every spine is drawn in, so a row of them stands on one line. */
const SPINE_ROOM = 92

/**
 * One book standing spine-out, as on a real shelf: cloth or leather in a
 * colour of its own, a height and thickness of its own (from its title),
 * raised bands, gilt ornaments and the title stamped up the spine.
 */
function spineBody(title: string, kind: string): { w: number; h: number; body: string } {
  const seed = hash(title)
  const w = 16 + (seed % 4) * 2
  const h = 72 + ((seed >>> 3) % 18)
  const color = SPINES[(seed >>> 7) % SPINES.length] ?? PALETTE.leather
  const isPale = color === '#d6c59a'
  const ink = isPale ? PALETTE.ink : PALETTE.gold
  const top = SPINE_ROOM - h
  const bottom = SPINE_ROOM
  let body =
    rect(0, top + 1, w, h - 1, color) +
    rect(1, top, w - 2, 1, color) +
    rect(0, top + 1, 1, h - 1, 'rgba(255,255,255,0.18)') +
    rect(1, top + 1, 1, h - 1, 'rgba(255,255,255,0.08)') +
    rect(w - 2, top + 1, 2, h - 1, 'rgba(0,0,0,0.30)') +
    // headband and tailband
    rect(1, top + 1, w - 3, 2, 'rgba(0,0,0,0.25)') +
    rect(1, bottom - 3, w - 3, 2, 'rgba(0,0,0,0.25)')
  // raised bands with a gilt rule
  const bands = [top + 7, bottom - 11]
  for (const y of bands) {
    body += rect(0, y, w, 3, 'rgba(0,0,0,0.28)') + rect(0, y, w, 1, 'rgba(255,255,255,0.20)') + rect(2, y + 3, w - 4, 1, ink)
  }
  // a gilt ornament between the head bands, one of a few kinds
  const cx = Math.floor(w / 2)
  const ornament = (seed >>> 11) % 4
  if (ornament === 0) body += rect(cx - 1, top + 3, 2, 1, ink) + rect(cx - 2, top + 4, 4, 1, ink) + rect(cx - 1, top + 5, 2, 1, ink)
  if (ornament === 1) body += rect(cx - 4, top + 4, 2, 2, ink) + rect(cx + 2, top + 4, 2, 2, ink)
  if (ornament === 2) body += rect(3, top + 3, w - 6, 1, ink) + rect(3, top + 5, w - 6, 1, ink)
  if (ornament === 3) body += rect(cx - 3, top + 4, 1, 1, ink) + rect(cx - 1, top + 4, 2, 1, ink) + rect(cx + 2, top + 4, 1, 1, ink)
  // and a second rule just above the foot block on some
  if ((seed >>> 13) % 2 === 0) body += rect(3, bottom - 14, w - 6, 1, ink)
  // gilt block at the foot, as old spines carry
  body += rect(cx - 3, bottom - 7, 6, 3, ink) + rect(cx - 2, bottom - 6, 4, 1, color)
  // the title, stamped bottom-to-top between the bands
  const from = bands[0]! + 6
  const to = bands[1]! - 3
  const room = to - from
  const fits = Math.max(1, Math.floor((room + 1) / 6))
  const raw = title.toUpperCase().replace(/^(THE|A|AN)\s+/, '')
  const label = raw.length > fits ? raw.slice(0, Math.max(1, fits - 1)) + '.' : raw
  const len = textWidth(label)
  body += rect(2, from - 2, w - 4, room + 4, 'rgba(0,0,0,0.22)')
  const x0 = Math.floor((w - 7) / 2)
  const y0 = to - Math.floor((room - len) / 2)
  body += `<g transform="translate(${x0} ${y0}) rotate(-90)">${pixelText(label, 0, 0, 1, ink)}</g>`
  // an EPUB carries a silk ribbon marker hanging from its head
  if (kind === 'epub') body += rect(w - 5, top - 1, 2, 4, '#c8402f')
  return { w, h, body }
}

/** One spine on its own, for a shelf laid out by the surface. */
export function spineSvg(title: string, kind: string): string {
  const { w, body } = spineBody(title, kind)
  return svg(w, SPINE_ROOM, body, 2)
}

/** Two books lying flat, stacked at the end of a shelf. */
export function stackSvg(): string {
  const body =
    rect(2, 10, 40, 8, '#2b4f7a') + rect(2, 10, 40, 1, 'rgba(255,255,255,0.2)') + rect(40, 11, 2, 6, PALETTE.paper) + rect(8, 13, 20, 1, PALETTE.gold) +
    rect(5, 2, 34, 8, '#8e2a2a') + rect(5, 2, 34, 1, 'rgba(255,255,255,0.2)') + rect(37, 3, 2, 6, PALETTE.paper) + rect(10, 5, 16, 1, PALETTE.gold) +
    rect(2, 18, 40, 1, 'rgba(0,0,0,0.4)')
  return svg(44, 19, body, 2)
}

/** The bookcase's crown: stone wall, cornice and a stepped pediment bearing the sign. */
export function crownSvg(title: string, subtitle: string): string {
  const w = 300
  const h = 64
  let body = stoneWall(w, h)
  // pediment steps rising to the middle
  for (let step = 0; step < 7; step++) {
    const inset = 40 + step * 12
    body += rect(inset, 48 - step * 4, w - inset * 2, 4, step % 2 ? PALETTE.wood : PALETTE.woodDark)
    body += rect(inset, 48 - step * 4, w - inset * 2, 1, PALETTE.woodLight)
  }
  // the plaque
  const t = title.toUpperCase()
  const sub = subtitle.toUpperCase()
  const pw = Math.max(textWidth(t, 2), textWidth(sub)) + 16
  const px = Math.round((w - pw) / 2)
  body += rect(px, 16, pw, 35, '#0d0806') + rect(px + 1, 17, pw - 2, 33, PALETTE.leather) + rect(px + 2, 18, pw - 4, 1, PALETTE.goldDark) + rect(px + 2, 48, pw - 4, 1, PALETTE.goldDark)
  body += pixelText(t, Math.round((w - textWidth(t, 2)) / 2) + 1, 22, 2, '#0d0806') + pixelText(t, Math.round((w - textWidth(t, 2)) / 2), 21, 2, PALETTE.gold)
  body += pixelText(sub, Math.round((w - textWidth(sub)) / 2), 39, 1, PALETTE.cream)
  // the cornice running the full width, with dentils
  body += rect(0, 52, w, 3, PALETTE.woodLight) + rect(0, 55, w, 5, PALETTE.wood) + rect(0, 60, w, 4, CASE.post)
  for (let x = 2; x < w; x += 8) body += rect(x, 56, 4, 3, PALETTE.woodDark)
  return wideSvg(w, h, body)
}

/** A shelf plank the full width of the case. */
export function shelfSvg(): string {
  const w = 300
  let body = rect(0, 0, w, 1, PALETTE.woodShine) + rect(0, 1, w, 3, PALETTE.woodLight) + rect(0, 4, w, 2, PALETTE.wood) + rect(0, 6, w, 1, PALETTE.woodDark) + rect(0, 7, w, 2, 'rgba(0,0,0,0.5)')
  for (let x = 9; x < w; x += 37) body += rect(x, 2, 6, 1, PALETTE.wood)
  return wideSvg(w, 9, body)
}

/** The base of the case, standing on flagstones. */
export function footSvg(): string {
  const w = 300
  let body = rect(0, 0, w, 14, '#26222b')
  for (let x = 0; x < w; x += 24) body += rect(x + 1, 9, 22, 4, '#302b36')
  body += rect(0, 0, w, 3, PALETTE.woodLight) + rect(0, 3, w, 4, PALETTE.wood) + rect(0, 7, w, 1, PALETTE.woodDark)
  body += rect(4, 8, 10, 3, PALETTE.woodDark) + rect(w - 14, 8, 10, 3, PALETTE.woodDark)
  return wideSvg(w, 14, body)
}

/** A cobweb strung in a top corner of a bay. */
/** Fine silk in a corner: thin spokes and sagging threads, as one path from the origin. */
function webPath(size: number): string {
  const spokes = [0, 25, 50, 72, 90].map(deg => (deg * Math.PI) / 180)
  const at = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r] as const
  let d = ''
  for (const a of spokes) {
    const [x, y] = at(size, a)
    d += `M0 0L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  for (const k of [0.22, 0.45, 0.7, 0.92]) {
    const r = size * k
    spokes.forEach((a, i) => {
      const next = spokes[i + 1]
      if (next === undefined) return
      const [x1, y1] = at(r, a)
      const [x2, y2] = at(r, next)
      const [mx, my] = at(r * 0.82, (a + next) / 2)
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
    })
  }
  return d
}

/** A cobweb strung in a top corner of a bay. */
export function webSvg(side: 'left' | 'right'): string {
  const size = 40
  const flip = side === 'right' ? ` transform="translate(${size} 0) scale(-1 1)"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 2}" height="${size * 2}"><g${flip}><path d="${webPath(size)}" fill="none" stroke="rgba(225,225,235,0.45)" stroke-width="0.5" stroke-linecap="round"/></g></svg>`
}

const LIFT = 7

/**
 * One spine on its own at a given pixel scale, for a shelf laid out by the
 * surface. The chosen book is drawn pulled up off the plank with a gilt
 * outline, the way a hand would tip it out to read.
 */
export function spineAt(title: string, kind: string, scale: number, isChosen = false): string {
  const { w, h, body } = spineBody(title, kind)
  const room = SPINE_ROOM + LIFT
  const pad = 2
  const top = SPINE_ROOM - h
  let art = `<g transform="translate(${pad} ${isChosen ? 0 : LIFT})">${body}</g>`
  if (isChosen) {
    art =
      `<rect x="0" y="${top - 2}" width="${w + pad * 2}" height="${h + 4}" fill="rgba(233,180,76,0.18)"/>` +
      art +
      rect(pad - 1, top - 1, w + 2, 1, PALETTE.gold) +
      rect(pad - 1, top + h, w + 2, 1, PALETTE.gold) +
      rect(pad - 1, top - 1, 1, h + 2, PALETTE.gold) +
      rect(pad + w, top - 1, 1, h + 2, PALETTE.gold)
  }
  const cw = w + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw} ${room}" width="${Math.round(cw * scale)}" height="${Math.round(room * scale)}" shape-rendering="crispEdges">${art}</svg>`
}

/** Empty room as tall as a spine at `scale`, so an empty shelf keeps its height. */
export function shelfRoomSvg(scale: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 ${SPINE_ROOM + LIFT}" width="1" height="${Math.round((SPINE_ROOM + LIFT) * scale)}"></svg>`
}

/** The small leather plaque that names the shelf. */
export function plaqueSvg(label: string): string {
  const sign = label.toUpperCase()
  const w = textWidth(sign) + 8
  const body = rect(w / 2 - 1, 0, 2, 3, PALETTE.goldDark) + rect(0, 3, w, 11, '#0d0806') + rect(1, 4, w - 2, 9, PALETTE.leather) + pixelText(sign, 4, 5, 1, PALETTE.gold)
  return svg(w, 14, body, 1.5)
}

/** A spider dangling on its thread, bobbing. Draw interactive. */
export function spiderSvg(): string {
  const w = 18
  const h = 60
  const body =
    `<rect x="8" y="0" width="1" height="26" fill="rgba(230,230,240,0.6)"><animate attributeName="height" values="26;36;26" dur="5s" repeatCount="indefinite"/></rect>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 10;0 0" dur="5s" repeatCount="indefinite"/>` +
    rect(5, 26, 7, 6, '#0a0608') + rect(6, 27, 5, 4, '#6a6470') + rect(7, 27, 3, 1, '#8a8490') + rect(7, 25, 3, 2, '#6a6470') +
    rect(2, 26, 3, 1, '#8a8490') + rect(12, 26, 3, 1, '#8a8490') + rect(1, 28, 4, 1, '#8a8490') + rect(12, 28, 4, 1, '#8a8490') +
    rect(2, 30, 3, 1, '#8a8490') + rect(12, 30, 3, 1, '#8a8490') + rect(1, 27, 1, 1, '#8a8490') + rect(15, 27, 1, 1, '#8a8490') +
    rect(0, 29, 1, 2, '#8a8490') + rect(16, 29, 1, 2, '#8a8490') + rect(7, 25, 1, 1, '#ff4040') + rect(9, 25, 1, 1, '#ff4040') +
    '</g>'
  return svg(w, h, body, 3)
}

/** A candle stub with running wax and a live flame. Draw interactive. */
export function candleSvg(): string {
  const body =
    `<circle cx="10" cy="12" r="9" fill="rgba(255,190,90,0.14)"><animate attributeName="r" values="9;7;10;9" dur="0.8s" repeatCount="indefinite"/></circle>` +
    rect(2, 34, 16, 3, PALETTE.goldDark) + rect(4, 33, 12, 1, PALETTE.gold) +
    rect(7, 18, 6, 15, PALETTE.cream) + rect(6, 21, 1, 6, PALETTE.cream) + rect(13, 24, 1, 5, PALETTE.cream) + rect(7, 18, 6, 1, '#fff') +
    rect(9, 15, 1, 3, '#222') +
    `<rect x="8" y="9" width="3" height="6" fill="#ffb340"><animate attributeName="fill" values="#ffb340;#ff8a2a;#ffd25a;#ffb340" dur="0.6s" repeatCount="indefinite"/><animate attributeName="height" values="6;5;7;6" dur="0.5s" repeatCount="indefinite"/></rect>`
  return svg(20, 37, body, 2)
}

/** Words carved on a dark bay: one gold line, then grey ones. */
export function carvedSvg(lines: readonly string[]): string {
  const w = Math.max(...lines.map(line => textWidth(line))) + 4
  const h = lines.length * 10
  const body = lines
    .map((line, i) => {
      const x = Math.round((w - textWidth(line)) / 2)
      return pixelText(line, x + 1, i * 10 + 2, 1, '#000') + pixelText(line, x, i * 10 + 1, 1, i === 0 ? PALETTE.gold : PALETTE.paperShade)
    })
    .join('')
  return svg(w, h, body, 2)
}

/** A rolled scroll lying on a shelf. */
export function scrollSvg(): string {
  const body = rect(2, 0, 22, 6, PALETTE.paper) + rect(2, 0, 22, 1, PALETTE.cream) + rect(0, 0, 3, 6, PALETTE.paperShade) + rect(23, 0, 3, 6, PALETTE.paperShade) + rect(12, 0, 2, 6, '#9a2a1f')
  return svg(26, 6, body, 3)
}

/** The bar over an open book: its title and a ribbon of progress. */
export function readerBarSvg(title: string, page: number, pages: number): string {
  const w = 200
  const h = 18
  const label = (title.length > 30 ? title.slice(0, 29) + '.' : title).toUpperCase()
  const counter = `${page}/${pages}`
  const done = pages > 0 ? Math.round(((w - 8) * page) / pages) : 0
  const body =
    rect(0, 0, w, h, PALETTE.leatherDark) +
    rect(1, 1, w - 2, h - 2, PALETTE.leather) +
    pixelText(label, 4, 3, 1, PALETTE.gold) +
    pixelText(counter, w - 4 - textWidth(counter), 3, 1, PALETTE.cream) +
    rect(4, 12, w - 8, 3, PALETTE.leatherDark) +
    rect(4, 12, done, 3, PALETTE.gold) +
    rect(4, 12, done, 1, PALETTE.cream)
  return svg(w, h, body, 3)
}

/** Sepia ink on warm paper: maps the page's grays from ink to paper. */
const SEPIA =
  '<filter id="sepia" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' +
  '0.725 0 0 0 0.228 ' +
  '0.729 0 0 0 0.161 ' +
  '0.663 0 0 0 0.090 ' +
  '0 0 0 1 0"/></filter>'

export type SpreadPage = { number: number; image?: { data: string; mime: string; width: number; height: number } }

/**
 * One page of an open book, drawn on its own so each page has a whole SVG's
 * room for its picture: paper on a leather board, the page in sepia, a
 * stepped shadow toward the spine (`left` pages have it on their right),
 * gold-stitched outer corners and the page number in pixels. A page with no
 * image yet is blank paper with a pixel hourglass. Fills the width it is given.
 */
export function pageSvg(page: SpreadPage, side: 'left' | 'right' | 'single', size: { width: number; height: number }): string {
  const m = 16
  const pw = size.width
  const ph = size.height
  const w = pw + m * 2
  const h = ph + m * 2 + 22
  let body = `<defs>${SEPIA}</defs>` + rect(0, 0, w, h, PALETTE.leatherDark)
  // the board, cut flush where the spine joins the facing page
  const bx = side === 'right' ? 0 : 4
  const bw = side === 'single' ? w - 8 : w - 4
  body += rect(bx, 4, bw, h - 8, PALETTE.leather)
  const corners: [number, number][] = side === 'left' ? [[8, 8], [8, h - 14]] : side === 'right' ? [[w - 14, 8], [w - 14, h - 14]] : [[8, 8], [w - 14, 8], [8, h - 14], [w - 14, h - 14]]
  for (const [x, y] of corners) {
    body += rect(x, y, 6, 2, PALETTE.gold) + rect(x, y, 2, 6, PALETTE.gold) + rect(x + 4, y + 4, 2, 2, PALETTE.gold)
  }
  body += rect(m - 4, m - 4, w - (m - 4) * 2, h - (m - 4) * 2, PALETTE.paperShade)
  body += rect(m - 2, m - 2, w - (m - 2) * 2, h - (m - 2) * 2, PALETTE.paper)
  if (page.image !== undefined) {
    const ix = m + Math.round((pw - page.image.width) / 2)
    const iy = m + Math.round((ph - page.image.height) / 2)
    body += `<image x="${ix}" y="${iy}" width="${page.image.width}" height="${page.image.height}" filter="url(#sepia)" href="data:${page.image.mime};base64,${page.image.data}"/>`
  } else {
    const cx = Math.round(w / 2)
    const cy = Math.round(h / 2)
    body +=
      rect(cx - 12, cy - 30, 24, 4, PALETTE.goldDark) +
      rect(cx - 12, cy + 26, 24, 4, PALETTE.goldDark) +
      rect(cx - 8, cy - 26, 16, 8, PALETTE.paperShade) +
      rect(cx - 4, cy - 18, 8, 8, PALETTE.paperShade) +
      rect(cx - 2, cy - 10, 4, 20, PALETTE.gold) +
      rect(cx - 8, cy + 14, 16, 12, PALETTE.gold)
  }
  if (side !== 'single') {
    ;[0.2, 0.13, 0.08, 0.04].forEach((alpha, k) => {
      const x = side === 'left' ? w - m - 4 * (k + 1) + 2 : m - 2 + 4 * k
      body += rect(x, m - 2, 4, h - (m - 2) * 2, `rgba(70,35,10,${alpha})`)
    })
    // half of the spine on the inner edge
    body += side === 'left' ? rect(w - 3, 4, 3, h - 8, PALETTE.leatherDark) + rect(w - 1, 4, 1, h - 8, PALETTE.goldDark) : rect(0, 4, 3, h - 8, PALETTE.leatherDark) + rect(0, 4, 1, h - 8, PALETTE.goldDark)
  }
  const label = String(page.number)
  body += pixelText(label, Math.round((w - textWidth(label, 2)) / 2), h - m - 16, 2, PALETTE.ink)
  return wideSvg(w, h, body)
}
