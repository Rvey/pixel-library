// The macOS side of the library: a JXA script that drives PDFKit, written to
// the library's cache at session start and run with `osascript -l JavaScript`.
//   info <pdf>                                           -> {"pages","title","author"}
//   render <pdf> <index> <out> <width> <maxBytes> <gray|color> -> {"width","height","bytes","format"}
//   epub <unzipped dir> <outPdf>                         -> {"title","author","cover"} (lays the book out as a 6x9in PDF)
export const HELPER_SOURCE = String.raw`
ObjC.import('Foundation')
ObjC.import('AppKit')
ObjC.import('PDFKit')

function openDoc(path) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(path))
  if (!doc || doc.isNil()) throw new Error('cannot open ' + path)
  return doc
}

function attr(doc, key) {
  const a = doc.documentAttributes
  if (!a || a.isNil()) return ''
  const v = a.objectForKey(key)
  return v && !v.isNil() ? ObjC.unwrap(v.description) : ''
}

function draw(page, width, gray) {
  const box = page.boundsForBox($.kPDFDisplayBoxCropBox)
  const scale = width / box.size.width
  const w = Math.max(1, Math.round(box.size.width * scale))
  const h = Math.max(1, Math.round(box.size.height * scale))
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, w, h, 8, gray ? 1 : 3, false, false, gray ? $.NSDeviceWhiteColorSpace : $.NSDeviceRGBColorSpace, 0, 0)
  const ctx = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep)
  $.NSGraphicsContext.saveGraphicsState
  $.NSGraphicsContext.setCurrentContext(ctx)
  const cg = ctx.CGContext
  $.CGContextSetRGBFillColor(cg, 1, 1, 1, 1)
  $.CGContextFillRect(cg, $.CGRectMake(0, 0, w, h))
  $.CGContextSetInterpolationQuality(cg, 3)
  $.CGContextScaleCTM(cg, scale, scale)
  page.drawWithBoxToContext($.kPDFDisplayBoxCropBox, cg)
  ctx.flushGraphics
  $.NSGraphicsContext.restoreGraphicsState
  return { rep, w, h }
}

// Fits the page under maxBytes: PNG if it fits, else JPEG down to a quality
// text still reads at, else the same again a little narrower.
function render(doc, index, out, width, maxBytes, mode) {
  const page = doc.pageAtIndex(index)
  if (!page || page.isNil()) throw new Error('no page ' + index)
  let target = width
  for (let attempt = 0; ; attempt++) {
    const { rep, w, h } = draw(page, target, mode !== 'color')
    const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary)
    if (png.length <= maxBytes) {
      png.writeToFileAtomically(out, true)
      return { width: w, height: h, bytes: png.length, format: 'png' }
    }
    for (let q = 0.75; q >= 0.4; q -= 0.1) {
      const props = $.NSDictionary.dictionaryWithObjectForKey($.NSNumber.numberWithDouble(q), $.NSImageCompressionFactor)
      const data = rep.representationUsingTypeProperties($.NSBitmapImageFileTypeJPEG, props)
      if (data.length <= maxBytes || attempt >= 6) {
        data.writeToFileAtomically(out, true)
        return { width: w, height: h, bytes: data.length, format: 'jpeg' }
      }
    }
    target = Math.round(target * 0.88)
  }
}

function xml(path) {
  const doc = $.NSXMLDocument.alloc.initWithContentsOfURLOptionsError($.NSURL.fileURLWithPath(path), 0, null)
  if (!doc || doc.isNil()) throw new Error('cannot read ' + path)
  return doc
}

function nodes(doc, xpath) {
  const arr = doc.nodesForXPathError(xpath, null)
  const out = []
  if (!arr || arr.isNil()) return out
  for (let i = 0; i < arr.count; i++) out.push(arr.objectAtIndex(i))
  return out
}

function xattr(node, name) {
  const a = node.attributeForName(name)
  return a && !a.isNil() ? ObjC.unwrap(a.stringValue) : ''
}

function text(doc, name) {
  const n = nodes(doc, "//*[local-name()='" + name + "']")[0]
  return n ? ObjC.unwrap(n.stringValue).trim() : ''
}

function epub(dir, out) {
  const container = xml(dir + '/META-INF/container.xml')
  const rootfile = nodes(container, "//*[local-name()='rootfile']")[0]
  if (!rootfile) throw new Error('no rootfile in container.xml')
  const opfPath = dir + '/' + xattr(rootfile, 'full-path')
  const opfDir = opfPath.indexOf('/') >= 0 ? opfPath.replace(/\/[^/]*$/, '') : dir
  const opf = xml(opfPath)
  const items = {}
  let cover = ''
  for (const item of nodes(opf, "//*[local-name()='item']")) {
    items[xattr(item, 'id')] = xattr(item, 'href')
    if (/cover-image/.test(xattr(item, 'properties'))) cover = xattr(item, 'href')
  }
  if (cover === '') {
    for (const meta of nodes(opf, "//*[local-name()='meta']")) {
      if (xattr(meta, 'name') === 'cover' && items[xattr(meta, 'content')]) cover = items[xattr(meta, 'content')]
    }
  }
  const spine = nodes(opf, "//*[local-name()='itemref']").map(r => items[xattr(r, 'idref')]).filter(Boolean)
  const all = $.NSMutableAttributedString.alloc.init
  const opts = $.NSDictionary.dictionaryWithObjectForKey($.NSHTMLTextDocumentType, $.NSDocumentTypeDocumentOption)
  spine.forEach(href => {
    const url = $.NSURL.fileURLWithPath(opfDir + '/' + decodeURIComponent(href.split('#')[0]))
    const part = $.NSAttributedString.alloc.initWithURLOptionsDocumentAttributesError(url, opts, null, null)
    if (!part || part.isNil() || part.length === 0) return
    if (all.length > 0) all.mutableString.appendString('\f')
    all.appendAttributedString(part)
  })
  if (all.length === 0) throw new Error('the book has no readable chapters')

  const pageW = 432, pageH = 648, margin = 40
  const info = $.NSPrintInfo.sharedPrintInfo.copy
  info.paperSize = $.NSMakeSize(pageW, pageH)
  info.topMargin = margin; info.bottomMargin = margin; info.leftMargin = margin; info.rightMargin = margin
  info.horizontalPagination = $.NSPrintingPaginationModeFit
  info.verticalPagination = $.NSPrintingPaginationModeAutomatic
  info.jobDisposition = $.NSPrintSaveJob
  info.dictionary.setObjectForKey($.NSURL.fileURLWithPath(out), $.NSPrintJobSavingURL)
  const view = $.NSTextView.alloc.initWithFrame($.NSMakeRect(0, 0, pageW - margin * 2, pageH - margin * 2))
  view.textStorage.setAttributedString(all)
  view.textContainerInset = $.NSMakeSize(0, 0)
  view.layoutManager.ensureLayoutForTextContainer(view.textContainer)
  view.sizeToFit
  const op = $.NSPrintOperation.printOperationWithViewPrintInfo(view, info)
  op.showsPrintPanel = false
  op.showsProgressPanel = false
  if (!op.runOperation) throw new Error('could not lay out the book')
  return {
    title: text(opf, 'title'),
    author: text(opf, 'creator'),
    cover: cover === '' ? '' : opfDir + '/' + decodeURIComponent(cover),
  }
}

function run(argv) {
  const [cmd, path, ...rest] = argv
  if (cmd === 'epub') return JSON.stringify(epub(path, rest[0]))
  const doc = openDoc(path)
  if (cmd === 'info') {
    return JSON.stringify({
      pages: Number(doc.pageCount),
      title: attr(doc, $.PDFDocumentTitleAttribute),
      author: attr(doc, $.PDFDocumentAuthorAttribute),
    })
  }
  if (cmd === 'render') {
    const [index, out, width, maxBytes, mode] = rest
    return JSON.stringify(render(doc, Number(index), out, Number(width), Number(maxBytes), mode))
  }
  throw new Error('unknown command ' + cmd)
}
`
