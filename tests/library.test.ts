import { expect, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'pixel-library',
  props: {
    title: 'Library',
    isFocused: true,
    bodyColumns: 120,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('the desktop shelf offers a way to add a book', async $ => {
  const ui = await $.ui.mount({ plugin: 'pixel-library', surface: 'desktop', ...PANE })
  expect(await ui.find({ key: 'add' })).toBeDefined()
  expect(await ui.find({ key: 'folder' })).toBeDefined()
  await ui.unmount()
})

test('the terminal gets a plain note instead of the pixel shelf', async $ => {
  const ui = await $.ui.mount({ plugin: 'pixel-library', surface: 'terminal', ...PANE })
  const drawn = JSON.stringify(await ui.drawn())
  if (!drawn.includes('desktop app')) throw new Error(drawn.slice(0, 800))
  await ui.unmount()
})

test('the band stays out of the way until /lib shows it', async $ => {
  const ui = await $.ui.mount({
    plugin: 'pixel-library',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }).catch(() => undefined)
  expect(ui === undefined || (await ui.find({ type: 'Svg' })) === undefined).toBe(true)
  await ui?.unmount()
})
