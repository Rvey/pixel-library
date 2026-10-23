import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, Timer } from 'claude-code'

import type { Book, PageImage, View } from '../types'
import { HELPER_SOURCE } from './helper'
import { candleSvg, carvedSvg, CASE, crownSvg, footSvg, PALETTE, readerBarSvg, scrollSvg, shelfSvg, spiderSvg, pageSvg, spineSvg, stackSvg, webSvg, spineAt, shelfRoomSvg, plaqueSvg } from './pixel'

const PANE = 'pixel-library'
const PAGE_WIDTH = 600
// Each page is its own Svg, held to 131072 characters: the page's bytes stay
// under this so, base64'd, they fit with the frame around them.
const PAGE_MAX_BYTES = 90000

const books = atom({ plugin: 'pixel-library', key: 'books' } as const, [])
const view = atom({ plugin: 'pixel-library', key: 'view' } as const, { mode: 'shelf' })
const spread = atom({ plugin: 'pixel-library', key: 'spread' } as const, null)
const note = atom({ plugin: 'pixel-library', key: 'note' } as const, '')
const isBusy = atom({ plugin: 'pixel-library', key: 'isBusy' } as const, false)
const isShelfShown = atom({ plugin: 'pixel-library', key: 'isShelfShown' } as const, false)
const chosen = atom({ plugin: 'pixel-library', key: 'chosen' } as const, '')

type Paths = { lib: string; cache: string; helper: string }

let paths: Paths | undefined
let ready: Promise<Paths> | undefined
// Set while drawing, read by the page buttons: how many pages a turn moves.
let isTwoUp = true
let loadSeq = 0
let noteTimer: Timer | undefined

function setup($: EngineInterface): Promise<Paths> {
  ready ??= (async () => {
    const home = (await $.env.get('HOME')) ?? ''
    const lib = `${home}/.claude/library`
    const found: Paths = { lib, cache: `${lib}/.cache`, helper: `${lib}/.cache/pdfbook.js` }
    await $.process.run(['mkdir', '-p', found.cache])
    await $.fs.write(found.helper, HELPER_SOURCE)
    paths = found
    return found
  })()
  return ready
}

async function helper($: EngineInterface, args: string[], timeoutMs = 60000): Promise<Record<string, unknown>> {
  const p = await setup($)
  const run = await $.process.run(['osascript', '-l', 'JavaScript', p.helper, ...args], { timeoutMs })
  if (run.exitCode !== 0) {
    throw new Error(run.stderr.trim().split('\n').pop() ?? 'the PDF helper failed')
  }
  return JSON.parse(run.stdout.trim()) as Record<string, unknown>
}

async function say($: EngineInterface, text: string): Promise<void> {
  noteTimer?.cancel()
  await update($, note, () => text)
  noteTimer = $.clock.after(6000, () => void update($, note, () => ''))
}

const BOOK_EXT = /\.(pdf|epub)$/i

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(BOOK_EXT, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'book'
  )
}

function prettyName(file: string): string {
  return file
    .replace(BOOK_EXT, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Reads the library folder into the shelf, measuring new books and drawing their covers. */
const BOOK_FILE = /\.(pdf|epub)$/i

/** Reads the library folder into the shelves, measuring new books and drawing their covers. */
async function scan($: EngineInterface): Promise<void> {
  const p = await setup($)
  const entries = await $.fs.list(p.lib)
  const files = entries.filter(entry => entry.kind === 'file' && BOOK_FILE.test(entry.name))
  const found: Book[] = []
  for (const entry of files) {
    const kind: Book['kind'] = /\.epub$/i.test(entry.name) ? 'epub' : 'pdf'
    // EPUB ids carry their kind so "x.pdf" and "x.epub" stay two books.
    const id = kind === 'epub' ? `${slug(entry.name)}-epub` : slug(entry.name)
    const file = `${p.lib}/${entry.name}`
    const dir = `${p.cache}/${id}`
    const pdf = kind === 'epub' ? `${dir}/book.pdf` : file
    try {
      type Meta = { title: string; pages: number; mtimeMs: number }
      let meta = (await $.store.get(`book:${id}`)) as Meta | undefined
      if (meta === undefined || meta.mtimeMs !== entry.mtimeMs || !(await $.fs.exists(pdf))) {
        await $.process.run(['rm', '-rf', dir])
        await $.process.run(['mkdir', '-p', dir])
        let title = ''
        if (kind === 'epub') {
          // An EPUB is a zip of XHTML chapters: unpack it, then let macOS typeset it into a PDF.
          const unzip = await $.process.run(['unzip', '-qq', '-o', file, '-d', `${dir}/epub`], { timeoutMs: 120000 })
          if (unzip.exitCode > 1) throw new Error(`could not unpack the EPUB: ${unzip.stderr.trim()}`)
          const made = await helper($, ['epub', `${dir}/epub`, pdf], 300000)
          title = String(made.title ?? '')
          const coverImage = String(made.cover ?? '')
          if (coverImage !== '') {
            await $.process.run(['sips', '--resampleWidth', '36', '-s', 'format', 'png', coverImage, '--out', `${dir}/cover.png`])
          }
        }
        const info = await helper($, ['info', pdf])
        if (title === '') title = String(info.title ?? '').trim()
        const isUseful = title.length > 2 && !/^(untitled|microsoft word|document)/i.test(title)
        meta = { title: isUseful ? title : prettyName(entry.name), pages: Number(info.pages) || 0, mtimeMs: entry.mtimeMs }
        await $.store.set(`book:${id}`, meta)
      }
      const coverPath = `${dir}/cover.png`
      if (!(await $.fs.exists(coverPath))) {
        await $.process.run(['mkdir', '-p', dir])
        await helper($, ['render', pdf, '0', coverPath, '36', '20000', 'color'])
      }
      const cover = (await $.fs.read(coverPath, { as: 'bytes' })).base64
      found.push({ id, file, pdf, kind, title: meta.title, pages: meta.pages, cover })
    } catch (error) {
      found.push({ id, file, pdf, kind, title: prettyName(entry.name), pages: 0 })
      await say($, `Could not open ${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  found.sort((a, b) => a.title.localeCompare(b.title))
  await update($, books, () => found)
}

function cleanPath(raw: string, home: string): string {
  let path = raw.trim().replace(/^['"]|['"]$/g, '')
  if (path.startsWith('file://')) path = decodeURIComponent(path.slice(7))
  path = path.replace(/\\(.)/g, '$1')
  if (path === '~' || path.startsWith('~/')) path = home + path.slice(1)
  return path.replace(/\/+$/, '')
}

async function addBook($: EngineInterface, raw: string): Promise<string> {
  const p = await setup($)
  const home = (await $.env.get('HOME')) ?? ''
  const src = cleanPath(raw, home)
  if (src === '') return 'Give me the path of a PDF or EPUB.'
  if (!BOOK_FILE.test(src)) return `Not a PDF or EPUB: ${src}`
  if (!(await $.fs.exists(src))) return `No file at ${src}`
  const kind = (await $.fs.stat(src)).kind
  // Apple Books keeps an EPUB as a folder; it is zipped back into one file, mimetype first and stored.
  const isFolderEpub = kind === 'dir' && /\.epub$/i.test(src)
  if (kind !== 'file' && !isFolderEpub) return `No file at ${src}`
  const name = src.split('/').pop() ?? 'book.pdf'
  const dest = `${p.lib}/${name}`
  if (await $.fs.exists(dest)) return `"${prettyName(name)}" is already on the shelf.`
  await update($, isBusy, () => true)
  try {
    const copy = isFolderEpub
      ? await $.process.run(['/bin/sh', '-c', 'cd "$1" && zip -qX0 "$2" mimetype && zip -qrX9 "$2" . -x mimetype -x .DS_Store', 'pack', src, dest])
      : await $.process.run(['cp', src, dest])
    if (copy.exitCode !== 0) {
      await $.process.run(['rm', '-f', dest])
      return `Could not copy it: ${copy.stderr.trim()}`
    }
    await scan($)
  } finally {
    await update($, isBusy, () => false)
  }
  const book = (await read($, books)).find(b => b.file === dest)
  return `Shelved "${book?.title ?? prettyName(name)}"${book && book.pages > 0 ? ` (${book.pages} pages)` : ''}.`
}

async function pageImage($: EngineInterface, book: Book, page: number): Promise<PageImage> {
  const p = await setup($)
  const dir = `${p.cache}/${book.id}`
  const file = `${dir}/p${page}-w${PAGE_WIDTH}-b${PAGE_MAX_BYTES}.img`
  let size: { width: number; height: number }
  if (await $.fs.exists(`${file}.json`)) {
    size = JSON.parse(await $.fs.read(`${file}.json`)) as { width: number; height: number }
  } else {
    await $.process.run(['mkdir', '-p', dir])
    const made = await helper($, ['render', book.pdf, String(page - 1), file, String(PAGE_WIDTH), String(PAGE_MAX_BYTES), 'gray'])
    size = { width: Number(made.width), height: Number(made.height) }
    await $.fs.write(`${file}.json`, JSON.stringify(size))
  }
  const data = (await $.fs.read(file, { as: 'bytes' })).base64
  return { page, data, mime: data.startsWith('iVBOR') ? 'image/png' : 'image/jpeg', ...size }
}

async function showPage($: EngineInterface, id: string, wanted: number): Promise<void> {
  const book = (await read($, books)).find(b => b.id === id)
  if (book === undefined) return
  const page = Math.min(Math.max(1, wanted), Math.max(1, book.pages))
  const seq = ++loadSeq
  await update($, view, () => ({ mode: 'read', id, page }) as View)
  await update($, spread, current => (current?.id === id && current.page === page ? current : { id, page, pages: [] }))
  await $.store.set(`page:${id}`, page)
  try {
    const pages: PageImage[] = []
    for (const n of [page, page + 1].filter(n => n <= book.pages)) {
      pages.push(await pageImage($, book, n))
      if (seq !== loadSeq) return
    }
    await update($, spread, () => ({ id, page, pages }))
    // Warm the next spread so the turn after this one is instant.
    void (async () => {
      for (const n of [page + 2, page + 3].filter(n => n <= book.pages)) {
        if (seq !== loadSeq) return
        await pageImage($, book, n).catch(() => undefined)
      }
    })()
  } catch (error) {
    await say($, `Could not draw page ${page}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function openBook($: EngineInterface, id: string): Promise<void> {
  try {
    // Books open in the side pane, wherever they were picked from.
    await $.ui.open({ id: PANE, title: 'Library', focus: true, closeOnEscape: true })
    const saved = (await $.store.get(`page:${id}`)) as number | undefined
    await showPage($, id, saved ?? 1)
  } catch (error) {
    $.ui.toast(`Could not open the book: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function turn($: EngineInterface, by: number | 'first' | 'last'): Promise<void> {
  const v = await read($, view)
  if (v.mode !== 'read') return
  const book = (await read($, books)).find(b => b.id === v.id)
  if (book === undefined) return
  const step = isTwoUp ? 2 : 1
  const target = by === 'first' ? 1 : by === 'last' ? Math.max(1, book.pages - step + 1) : v.page + by * step
  if (target < 1 || target > book.pages) return
  await showPage($, v.id, target)
}

async function openPane($: EngineInterface, focus: boolean): Promise<void> {
  await $.ui.open(focus ? { id: PANE, title: 'Library', focus: true } : { id: PANE, title: 'Library' })
  void scan($).catch(error => say($, `Could not read the shelf: ${String(error)}`))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lib',
      description: 'Show or hide the pixel library: read your PDFs and EPUBs while Claude works',
      argumentHint: '[add <book.pdf|book.epub> | folder | <title>]',
      immediate: true,
    })
    void setup($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'lib' }, async ($, e) => {
    const args = e.args.trim()
    const [verb = '', ...rest] = args.split(/\s+/)
    const tail = args.slice(verb.length).trim()
    if (verb === 'add') {
      await update($, isShelfShown, () => true)
      return { text: await addBook($, tail) }
    }
    if (verb === 'folder') {
      const p = await setup($)
      await $.process.run(['open', p.lib])
      return { text: `Opened ${p.lib}` }
    }
    if (args !== '') {
      await scan($)
      const query = args.toLowerCase()
      const book = (await read($, books)).find(b => b.title.toLowerCase().includes(query) || b.id.includes(query))
      await openPane($, true)
      if (book === undefined) return { text: `No book matches "${args}".` }
      await openBook($, book.id)
      return { text: `Opened "${book.title}".` }
    }
    // /lib shows or hides the shelf in the band above the prompt.
    const isShown = !(await read($, isShelfShown))
    await update($, isShelfShown, () => isShown)
    if (!isShown) return { text: 'Library shelf hidden.' }
    await scan($)
    const count = (await read($, books)).length
    return { text: `Library shelf shown above the prompt: ${count === 1 ? '1 book' : `${count} books`}. Click a spine's number, or ctrl+x tab then 1-9 / Tab and Enter.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const columns = e.props.bodyColumns
    const v = await read($, view)
    const shelf = await read($, books)
    const message = await read($, note)
    const busy = await read($, isBusy)

    if (e.surface === 'terminal' || e.surface === 'mobile' || !('Svg' in ui) || !('Input' in ui)) {
      return (
        <Box flexDirection="column">
          <Text bold>Pixel Library</Text>
          <Text dimColor>{`Open this session in the Claude desktop app to read. Books: ${shelf.length}`}</Text>
          {shelf.map(book => (
            <Text>{`· ${book.title}`}</Text>
          ))}
        </Box>
      )
    }
    const { Svg, Input } = ui

    if (v.mode === 'read') {
      const book = shelf.find(b => b.id === v.id)
      const s = await read($, spread)
      isTwoUp = columns >= 90
      const total = book?.pages ?? 0
      const numbers = [v.page, v.page + 1].filter(n => n <= Math.max(total, 1)).slice(0, isTwoUp ? 2 : 1)
      const images = s !== null && s.id === v.id && s.page === v.page ? s.pages : []
      const shown = numbers.map(number => ({ number, image: images.find(img => img.page === number) }))
      const size = {
        width: Math.max(PAGE_WIDTH, ...images.map(img => img.width)),
        height: Math.max(...images.map(img => img.height), Math.round(PAGE_WIDTH * 1.4)),
      }
      const last = numbers[numbers.length - 1] ?? v.page
      return (
        <Box flexDirection="column" gap="sm" backgroundColor={PALETTE.night} padding="sm">
          <Svg source={readerBarSvg(book?.title ?? 'Book', last, total)} alt={`${book?.title ?? 'Book'}, page ${v.page} of ${total}`} />
          <Box flexDirection="row" justifyContent="center">
            {shown.map((page, i) => (
              <Box key={`page-${i}`} width={shown.length === 2 ? '50%' : '100%'}>
                <Svg
                  source={pageSvg(page, shown.length === 1 ? 'single' : i === 0 ? 'left' : 'right', size)}
                  alt={`Page ${page.number} of ${book?.title ?? 'the book'}`}
                />
              </Box>
            ))}
          </Box>
          <Box flexDirection="row" gap="sm" justifyContent="center" flexWrap="wrap">
            <Button key="shelf" hotkey="b" label="◂ Shelf" onPress={() => void update($, view, () => ({ mode: 'shelf' }) as View)} />
            <Button key="first" label="⏮" onPress={() => void turn($, 'first')} />
            <Button key="prev" hotkey="p" label="◂ Prev" onPress={() => void turn($, -1)} />
            <Button key="next" hotkey="n" variant="primary" autoFocus label="Next ▸" onPress={() => void turn($, 1)} />
            <Button key="last" label="⏭" onPress={() => void turn($, 'last')} />
            <Button key="preview" dimColor label={book?.kind === 'epub' ? 'Open in Books' : 'Open in Preview'} onPress={() => void (book && $.process.run(['open', book.file]))} />
          </Box>
          <Input
            key="goto"
            placeholder={`Go to page (1–${total})`}
            submitLabel="go"
            onSubmit={value => {
              const n = Number.parseInt(value, 10)
              if (Number.isFinite(n)) void showPage($, v.id, n)
            }}
          />
          {message !== '' && <Text color={PALETTE.gold}>{message}</Text>}
        </Box>
      )
    }

    return drawShelf($, { Box, Text, Button, Svg, Input }, columns, shelf, message, busy)
  })

  // The shelf lives in the band just above the prompt while /lib has it shown.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface !== 'desktop' || !(await read($, isShelfShown))) return next(e)
    const shelf = await read($, books)
    const busy = await read($, isBusy)
    return drawBand($, $.ui.resolve(e), shelf, await read($, chosen), busy)
  })

  // The keyboard's ring walking the band's spines picks the book it rests on.
  on('ui.focus', { component: 'AbovePrompt' }, async ($, e, next) => {
    const element = e.plugin === 'pixel-library' ? (e.element ?? '') : ''
    await update($, chosen, () => (element.startsWith('read:') ? element.slice(5) : ''))
    return next(e)
  }).catch(($, e, next) => next(e))

}

type ShelfElements = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg' | 'Input'>

type BandElements = Pick<Elements['desktop'], 'Box' | 'Svg' | 'Button'>

const BAND_SCALE = 1.25

/** The key that picks the book at `index` on the shelf: 1-9, then a-z. */
function shelfKey(index: number): string | undefined {
  return index < 9 ? String(index + 1) : 'abcdefghijklmnopqrstuvwxyz'[index - 9]
}

/**
 * The shelf as a band stuck to the prompt: one full-width shelf of spines,
 * each with its key under it. The band takes the keyboard with ctrl+x tab
 * or a click: Tab and the arrows walk the books (the chosen one is pulled
 * up off the plank), Enter or its key opens it in the reader.
 */
function drawBand($: EngineInterface, ui: BandElements, shelf: readonly Book[], picked: string, busy: boolean) {
  const { Box, Svg, Button } = ui
  const count = shelf.length === 1 ? '1 book' : `${shelf.length} books`
  const choice = shelf.find(book => book.id === picked)
  const plaque = busy
    ? 'shelving...'
    : choice !== undefined
      ? `${choice.title.length > 34 ? choice.title.slice(0, 33) + '.' : choice.title} - enter to read`
      : `Pixel Library - ${shelf.length === 0 ? 'empty' : `${count} - ctrl+x tab, then 1-9`}`
  return (
    <Box flexDirection="column" backgroundColor={CASE.post} paddingX={1}>
      <Box flexDirection="row" alignItems="flex-end" backgroundColor={CASE.back} position="relative" paddingX={2} paddingTop={1}>
        <Svg source={shelfRoomSvg(BAND_SCALE)} alt="Shelf space" />
        {shelf.map((book, i) => {
          const key = shelfKey(i)
          return (
            <Box key={`spine-${book.id}`} flexDirection="column" alignItems="center">
              <Svg source={spineAt(book.title, book.kind, BAND_SCALE, book.id === picked)} alt={book.title} />
              <Button
                key={`read:${book.id}`}
                plain
                dimColor={book.id !== picked}
                label={key ?? '·'}
                {...(key !== undefined ? { hotkey: key } : {})}
                {...(i === 0 ? { autoFocus: true as const } : {})}
                onPress={() => void openBook($, book.id)}
              />
            </Box>
          )
        })}
        <Box flexGrow={1} />
        <Box flexDirection="column" alignItems="flex-end" gap="xs">
          <Svg source={plaqueSvg(plaque)} alt={choice !== undefined ? `${choice.title}: press Enter to read` : `Pixel Library, ${count}`} />
          <Svg source={stackSvg()} alt="A stack of old books" />
        </Box>
        <Box position="absolute" top={0} left={0}>
          <Svg source={webSvg('left')} alt="Cobweb" />
        </Box>
      </Box>
      <Svg source={shelfSvg()} alt="Wooden shelf" />
    </Box>
  )
}

/** The whole bookcase: crown, shelves of spines, base, catalogue and the add field. */
function drawShelf($: EngineInterface, ui: ShelfElements, columns: number, shelf: readonly Book[], message: string, busy: boolean) {
  const { Box, Text, Button, Svg, Input } = ui
  // A spine is about 40px wide; at about 8px a column that is 5 columns.
  const perRow = Math.max(1, Math.min(40, Math.floor((columns - 12) / 5)))
  const rows: Book[][] = []
  for (let i = 0; i < shelf.length; i += perRow) rows.push(shelf.slice(i, i + perRow))
  while (rows.length < 3) rows.push([])
  const short = (title: string) => (title.length > 28 ? title.slice(0, 27) + '…' : title)
  const count = shelf.length === 1 ? '1 book on the shelves' : `${shelf.length} books on the shelves`
  const isEmpty = shelf.length === 0
  const spacer = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 100" width="1" height="200"></svg>'
  return (
    <Box flexDirection="column" backgroundColor={CASE.stone}>
      <Svg source={crownSvg('Pixel Library', busy ? 'shelving...' : isEmpty ? 'awaits its first tome' : count)} alt={`Pixel Library, ${count}`} />
      <Box flexDirection="column" backgroundColor={CASE.post} paddingX={2}>
        {rows.map((row, i) => (
          <Box key={`bay-${i}`} flexDirection="column">
            <Box flexDirection="row" position="relative" backgroundColor={CASE.back} paddingX={2} paddingTop={1} gap={2} alignItems="flex-end">
              <Svg source={spacer} alt="Shelf space" />
              <Box flexDirection="row" alignItems="flex-end">
                {row.map(book => (
                  <Box key={`book-${book.id}`} position="relative">
                    <Svg source={spineSvg(book.title, book.kind)} alt={book.title} />
                    <Box position="absolute" top={1} left={0} display="none" hover={{ display: 'flex' }}>
                      <Button key={`open:${book.id}`} variant="primary" label="Read" onPress={() => void openBook($, book.id)} />
                    </Box>
                  </Box>
                ))}
              </Box>
              {row.length > 0 && row.length <= perRow - 4 && <Svg source={stackSvg()} alt="A stack of old books" />}
              {row.length === 0 && i % 3 === 0 && <Svg source={spiderSvg()} isInteractive alt="A spider on its thread" />}
              {row.length === 0 && i % 3 === 1 && <Svg source={candleSvg()} isInteractive alt="A candle" />}
              {row.length === 0 && i % 3 === 1 && isEmpty && (
                <Svg source={carvedSvg(['NAUGHT BUT DUST AND SPIDERS', 'SHELVE A PDF OR EPUB BELOW', 'OR LAY ONE IN ~/.CLAUDE/LIBRARY'])} alt="Nothing but dust and spiders. Shelve a PDF or EPUB below." />
              )}
              {row.length === 0 && i % 3 === 2 && <Svg source={scrollSvg()} alt="A forgotten scroll" />}
              {row.length < perRow && (
                <Box position="absolute" top={0} right={0}>
                  <Svg source={webSvg('right')} alt="Cobweb" />
                </Box>
              )}
              {(row.length === 0 || i % 2 === 1) && (
                <Box position="absolute" top={0} left={0}>
                  <Svg source={webSvg('left')} alt="Cobweb" />
                </Box>
              )}
            </Box>
            <Svg source={shelfSvg()} alt="Wooden shelf" />
          </Box>
        ))}
      </Box>
      <Svg source={footSvg()} alt="Base of the bookcase" />
      <Box flexDirection="column" gap="sm" padding="sm">
      {!isEmpty && <Text color={PALETTE.gold} weight="semibold">Catalogue</Text>}
      {!isEmpty && (
        <Box flexDirection="row" gap="sm" flexWrap="wrap">
          {shelf.map(book => (
            <Button key={`cat:${book.id}`} plain dimColor onPress={() => void openBook($, book.id)}>
              {short(book.title)}
            </Button>
          ))}
        </Box>
      )}
      <Input
        key="add"
        label="Add a book"
        placeholder="/path/to/book.pdf or .epub"
        submitLabel="shelve"
        onSubmit={value => void addBook($, value).then(text => say($, text))}
      />
      <Box flexDirection="row" gap="sm">
        <Button key="folder" dimColor label="Open library folder" onPress={() => void (paths && $.process.run(['open', paths.lib]))} />
        <Button key="rescan" dimColor label="Rescan" onPress={() => void scan($)} />
      </Box>
      {message !== '' && <Text color={PALETTE.gold}>{message}</Text>}
      </Box>
    </Box>
  )
}
