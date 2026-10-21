export type Book = {
  id: string
  /** The book as shelved: a PDF or an EPUB in the library folder. */
  file: string
  /** The PDF its pages are drawn from: the file itself, or the EPUB typeset into one. */
  pdf: string
  kind: 'pdf' | 'epub'
  title: string
  pages: number
  /** Tiny color PNG of page one, base64, drawn pixelated. */
  cover?: string
}

export type PageImage = {
  page: number
  data: string
  mime: string
  width: number
  height: number
}

export type Spread = { id: string; page: number; pages: PageImage[] }

export type View = { mode: 'shelf' } | { mode: 'read'; id: string; page: number }

declare module 'claude-code' {
  interface PluginState {
    'pixel-library': {
      books: Book[]
      view: View
      spread: Spread | null
      note: string
      isBusy: boolean
      /** Whether /lib has the shelf shown in the band above the prompt. */
      isShelfShown: boolean
      /** The book the keyboard rests on in the band's shelf, by id; empty for none. */
      chosen: string
    }
  }
}
