// qlf playground: loads the latest qlf from jsDelivr, no build step.
import { SAMPLE_DATA, EXAMPLES, SAMPLE_FUNCTIONS } from './sample-data.js'
import { ATOM_RE, trace, unguard } from './trace.js'

// Same file on each CDN; the first one that loads wins. ?cdn=unpkg puts unpkg first.
// ?cdn=local loads the build of this repository, when the repository root is served.
const CDNS = [
  { name: 'jsDelivr', id: 'jsdelivr', url: 'https://cdn.jsdelivr.net/npm/qlf@latest/dist/qlf.mjs', page: 'https://www.jsdelivr.com/package/npm/qlf' },
  { name: 'unpkg', id: 'unpkg', url: 'https://unpkg.com/qlf@latest/dist/qlf.mjs', page: 'https://unpkg.com/browse/qlf@latest/' },
  { name: 'the local build', id: 'local', url: new URL('../dist/qlf.mjs', import.meta.url).href, page: '../dist/qlf.mjs', onlyWhenAsked: true },
]
const SETTINGS = ['caseSensitive', 'strictEquality', 'strictFilter']
const VIEWS = ['data', 'item']
const KINDS = { Strings: 'string', Calls: 'call', Grammars: 'grammar' }

const $ = (id) => document.getElementById(id)
const els = {
  query: $('query'),
  status: $('status'),
  examples: $('examples'),
  table: $('table'),
  count: $('count'),
  dataSource: $('data-source'),
  onlyMatches: $('only-matches'),
  openData: $('open-data'),
  dialog: $('data-dialog'),
  dataInput: $('data-input'),
  dataCheck: $('data-check'),
  setData: $('set-data'),
  resetData: $('reset-data'),
  cdnLink: $('cdn-link'),
  functionsInput: $('functions-input'),
  functionsCheck: $('functions-check'),
  functionsNames: $('functions-names'),
  tabs: { data: $('tab-data'), item: $('tab-item') },
  panels: { data: $('panel-data'), item: $('panel-item') },
  itemInput: $('item-input'),
  itemCheck: $('item-check'),
  itemPick: $('item-pick'),
  verdict: $('verdict'),
  grammarList: $('grammar-list'),
  stepList: $('step-list'),
  dictionary: $('dictionary'),
  hideGuards: $('hide-guards'),
  showFunction: $('show-function'),
  functionView: $('function-view'),
  callList: $('call-list'),
  nodeName: $('nodeName'),
}

const storage = {
  get(key) { try { return localStorage.getItem('qlf-playground:' + key) } catch { return null } },
  set(key, value) { try { localStorage.setItem('qlf-playground:' + key, value) } catch { /* storage unavailable */ } },
  remove(key) { try { localStorage.removeItem('qlf-playground:' + key) } catch { /* storage unavailable */ } },
}

let QLF = null
let view = 'data'
let data = SAMPLE_DATA
let dataText = null // the text the user set, null for sample data
let columns = []
let rows = []
let functions = null // parsed functions, null when the text is broken
let item = null // parsed item, null when the text is broken

// ---------- parsing ----------

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

// A JSON array of objects, JSON Lines, or one object.
function parseData(text) {
  const source = text.trim()
  if (!source) return { error: 'Paste some data first.' }

  // A whole JSON document: an array of objects, or one object.
  let whole
  let wholeError = null
  try {
    whole = JSON.parse(source)
  } catch (error) {
    wholeError = error
  }

  if (!wholeError) {
    if (isRecord(whole)) return { rows: [whole], format: 'JSON object' }
    if (!Array.isArray(whole)) return { error: 'Expected a JSON array of objects or JSON Lines.' }
    const bad = whole.findIndex((row) => !isRecord(row))
    if (bad !== -1) return { error: `Item ${bad + 1} of the array is not an object.` }
    return { rows: whole, format: 'JSON array' }
  }

  // Starts like an array, so report the JSON error rather than a JSON Lines one.
  if (source.startsWith('[')) return { error: `Invalid JSON: ${wholeError.message}` }

  // JSON Lines: one object per non-empty line.
  const lines = source.split(/\r?\n/)
  const parsed = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    let value
    try {
      value = JSON.parse(line)
    } catch (error) {
      // Drop the browser's "(line 1 column N)" since each line is parsed on its own.
      const message = error.message
        .replace(/ in JSON at position \d+ \(line \d+ column (\d+)\)/, ', column $1')
        .replace(/ at line \d+ column (\d+) of the JSON data/, ', column $1')
      return { error: `Line ${i + 1}: ${message}` }
    }
    if (!isRecord(value)) return { error: `Line ${i + 1} is not a JSON object.` }
    parsed.push(value)
  }
  return { rows: parsed, format: 'JSON Lines' }
}

// One JSON object.
function parseItem(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    return { error: `Invalid JSON: ${error.message}` }
  }
  if (!isRecord(value)) return { error: 'The item should be one JSON object.' }
  return { item: value }
}

// A JavaScript object of functions. It is your own code running in your browser.
function parseFunctions(text) {
  if (!text.trim()) return { functions: {} }
  let value
  try {
    value = new Function(`"use strict"; return (\n${text}\n)`)()
  } catch (error) {
    return { error: error.message }
  }
  if (!isRecord(value)) return { error: 'Expected an object, like { me: () => "mark" }.' }
  for (const [name, fn] of Object.entries(value)) {
    if (typeof fn !== 'function') return { error: `${name} is not a function.` }
  }
  return { functions: value }
}

// ---------- table ----------

function applyData(next, text) {
  data = next
  dataText = text
  columns = []
  for (const row of data) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key)
  }
  els.dataSource.textContent = text === null ? 'sample issues' : 'your data'
  renderTable()
  renderItemPick()
}

function formatCell(value) {
  if (value === null || value === undefined) return { text: String(value), kind: 'is-null' }
  if (Array.isArray(value)) return { text: JSON.stringify(value), kind: 'is-array' }
  if (typeof value === 'object') return { text: JSON.stringify(value), kind: 'is-object' }
  if (typeof value === 'number') return { text: String(value), kind: 'is-number' }
  return { text: String(value), kind: '' }
}

function renderTable() {
  els.table.replaceChildren()
  rows = []
  if (!data.length) {
    const caption = document.createElement('caption')
    caption.className = 'empty'
    caption.textContent = 'No rows. Use “Set your data” to add some.'
    els.table.append(caption)
    return
  }

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const col of columns) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.textContent = col
    headRow.append(th)
  }
  thead.append(headRow)

  const tbody = document.createElement('tbody')
  rows = data.map((row) => {
    const tr = document.createElement('tr')
    columns.forEach((col, index) => {
      const td = document.createElement('td')
      td.style.setProperty('--col', String(index))
      const { text, kind } = formatCell(row[col])
      td.textContent = text
      if (kind) td.className = kind
      tr.append(td)
    })
    tbody.append(tr)
    return tr
  })

  els.table.append(thead, tbody)
}

// ---------- run ----------

function setStatus(el, text, kind = '') {
  el.textContent = text
  el.classList.toggle('is-error', kind === 'error')
  el.classList.toggle('is-ok', kind === 'ok')
}

// a variable and its properties or indexes: node, row.data, item.a[0].c
const NODE_NAME_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/

const readNodeName = () => els.nodeName.value.trim() || 'node'
const nodeNameIsValid = () => NODE_NAME_RE.test(readNodeName())

function readSettings() {
  const settings = {}
  for (const name of SETTINGS) settings[name] = $(name).checked
  settings.nodeName = readNodeName()
  return settings
}

// What the filter gets: the item placed at nodeName. For row.data it is { data: item }.
function contextFor(node) {
  const [, ...path] = readNodeName().split(/[.[\]]/).filter(Boolean)
  return path.reduceRight((inner, part) => {
    if (!/^\d+$/.test(part)) return { [part]: inner }
    const list = []
    list[Number(part)] = inner
    return list
  }, node)
}

// nodeName is code in the filter, so a broken one stops both tabs
function checkNodeName() {
  const valid = nodeNameIsValid()
  els.nodeName.setAttribute('aria-invalid', String(!valid))
  if (!valid) setStatus(els.status, 'nodeName should be a path like node, row.data or item.list[0].', 'error')
  return valid
}

const readSyntax = () => (functions ? { functions } : undefined)

function run() {
  if (!QLF) return
  const query = els.query.value.trim()

  for (const btn of els.examples.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.query === query))
  }
  writeHash(query)
  if (!checkNodeName()) return

  if (view === 'item') runItem(query)
  else runData(query)
}

function runData(query) {
  const tbody = els.table.querySelector('tbody')
  for (const tr of rows) tr.classList.remove('is-match', 'is-hidden', 'is-row-error')

  if (!query) {
    tbody?.classList.remove('has-query')
    els.count.innerHTML = `<b>${data.length}</b> rows`
    setStatus(els.status, 'Type a query or pick an example below.')
    return
  }

  tbody?.classList.add('has-query')

  let filter
  try {
    filter = new QLF(readSettings(), readSyntax()).transpile(query).filter
  } catch (error) {
    els.count.textContent = ''
    setStatus(els.status, error.message, 'error')
    return
  }

  let matches = 0
  let firstError = null
  data.forEach((row, i) => {
    let ok = false
    try {
      ok = Boolean(filter(contextFor(row)))
    } catch (error) {
      rows[i].classList.add('is-row-error')
      firstError ??= error
    }
    if (ok) matches++
    rows[i].classList.toggle('is-match', ok)
    rows[i].classList.toggle('is-hidden', !ok && els.onlyMatches.checked)
  })

  els.count.innerHTML = `<b>${matches}</b> of ${data.length} match`
  if (firstError) setStatus(els.status, firstError.message, 'error')
  else setStatus(els.status, matches ? 'Query compiled.' : 'Query compiled. No rows match.')
}

let timer
function scheduleRun() {
  clearTimeout(timer)
  timer = setTimeout(run, 120)
}

// ---------- one item: the query step by step ----------

function runItem(query) {
  els.grammarList.replaceChildren()
  els.stepList.replaceChildren()
  els.dictionary.replaceChildren()
  els.callList.replaceChildren()
  els.functionView.hidden = !els.showFunction.checked

  if (!query) {
    setStatus(els.status, 'Type a query or pick an example below.')
    renderVerdict('empty', 'No query', 'Type a query to follow it through the transpiler.')
    renderCallsNote('Type a query to see the function.')
    return
  }

  const result = trace(QLF, readSettings(), readSyntax(), query)
  const hide = els.hideGuards.checked
  const code = (text) => renderCode(text, result, hide)

  renderSteps(query, result, code)
  renderGrammars(result, code)
  renderDictionary(result, code)

  if (result.error) {
    setStatus(els.status, result.error.message, 'error')
    renderVerdict('error', 'Does not compile', result.error.message)
    renderCallsNote('The query does not compile, so there is no function.')
    return
  }
  setStatus(els.status, 'Query compiled.')

  if (!item) {
    renderVerdict('empty', 'No item', 'Fix the item on the left to see the result.')
    renderCallsNote('Fix the item to see how the function is called.')
    return
  }

  const context = contextFor(item)
  const outcome = result.run(context)
  if (outcome.error) {
    renderVerdict('error', 'Fails on this item', outcome.error.message)
  } else {
    const value = outcome.value
    renderVerdict(value ? 'match' : 'miss', value ? 'Matches' : 'Does not match', `The filter returns ${formatValue(value)}.`)
  }
  renderCalls(context, outcome, code)
}

function renderCallsNote(text) {
  const li = document.createElement('li')
  li.className = 'muted'
  li.textContent = text
  els.callList.replaceChildren(li)
}

// A short text of any argument: functions by name, data as JSON.
function formatArgument(value) {
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}`
  const text = formatValue(value)
  return text.length > 220 ? text.slice(0, 219) + '…' : text
}

function outcomeBadge(call) {
  const badge = document.createElement('span')
  if (call.error) {
    badge.className = 'value is-error'
    badge.textContent = `throws ${call.error.message}`
  } else {
    const text = formatArgument(call.result)
    badge.className = `value is-${call.result ? 'true' : 'false'}`
    badge.textContent = `returns ${text}`
    badge.title = text
  }
  return badge
}

function argumentList(names, values) {
  const dl = document.createElement('dl')
  dl.className = 'args'
  names.forEach((name, index) => {
    const dt = document.createElement('dt')
    dt.textContent = name
    const dd = document.createElement('dd')
    dd.textContent = formatArgument(values[index])
    if (typeof values[index] === 'function') dd.classList.add('is-function')
    dl.append(dt, dd)
  })
  return dl
}

function renderCalls(context, outcome, code) {
  // how your code calls the filter
  const entry = document.createElement('li')
  entry.className = 'call is-entry'
  const entryHead = document.createElement('div')
  entryHead.className = 'call-head'
  const entryTitle = document.createElement('b')
  entryTitle.textContent = 'filter(context)'
  entryHead.append(entryTitle, outcomeBadge({ result: outcome.value, error: outcome.error }))
  const note = document.createElement('p')
  note.className = 'muted'
  note.style.margin = '0'
  note.textContent = readNodeName() === 'node'
    ? 'Your code calls the filter with the item itself: nodeName is node.'
    : `Your code calls the filter with an object that holds the item at ${readNodeName()}.`
  entry.append(entryHead, note, argumentList(['context'], [context]))
  els.callList.replaceChildren(entry)

  // what the filter calls inside: the functions qlf created
  outcome.calls.forEach((call, index) => {
    const li = document.createElement('li')
    li.className = 'call'
    const head = document.createElement('div')
    head.className = 'call-head'
    const title = document.createElement('b')
    title.textContent = `new Function #${index + 1}`
    head.append(title, outcomeBadge(call))

    const pre = document.createElement('pre')
    const text = document.createElement('code')
    text.className = 'code'
    text.append(code(call.record.text))
    pre.append(text)

    li.append(head, pre, argumentList(call.record.params, call.args))
    els.callList.append(li)
  })
}

function renderVerdict(kind, title, detail) {
  els.verdict.className = `verdict is-${kind}`
  const strong = document.createElement('strong')
  strong.textContent = title
  const span = document.createElement('span')
  span.textContent = detail
  els.verdict.replaceChildren(strong, span)
}

function formatValue(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined || typeof value === 'function') return String(value)
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

// What a part of the code gives for the item: true, false, a value, or an error.
function evaluate(result, text) {
  if (!item) return { kind: 'none', text: 'no item' }
  try {
    const value = result.compile(result.expand(text))(contextFor(item))
    return { kind: value ? 'true' : 'false', text: formatValue(value) }
  } catch (error) {
    return { kind: 'error', text: error.message }
  }
}

// Text of code with dictionary keys shown as chips.
function renderCode(text, result, hide) {
  const fragment = document.createDocumentFragment()
  const plain = (part) => (hide ? unguard(part) : part)
  let last = 0
  for (const match of text.matchAll(ATOM_RE)) {
    fragment.append(plain(text.slice(last, match.index)), chip(match[0], result))
    last = match.index + match[0].length
  }
  fragment.append(plain(text.slice(last)))
  return fragment
}

function atomLabel(key, result) {
  const atom = result.atoms.get(key)
  if (!atom) return key
  if (atom.kind === 'Grammars') return atom.template ?? key
  if (atom.kind === 'Calls') return unguard(result.expand(atom.value))
  return atom.value
}

function chip(key, result) {
  const atom = result.atoms.get(key)
  const span = document.createElement('span')
  span.className = `atom kind-${KINDS[atom?.kind] ?? 'other'}`
  if (atom?.unquoted) span.classList.add('is-unquoted')
  span.dataset.key = key
  span.textContent = atomLabel(key, result)
  span.title = `${key}\n${atom ? atom.value : 'not in the dictionary'}`
  return span
}

function renderSteps(query, result, code) {
  const list = [{ label: 'Query', note: 'What you typed.', output: query }, ...result.steps]
  for (const step of list) {
    const li = document.createElement('li')
    li.className = 'step'
    const same = step.input !== undefined && step.input.trim() === step.output.trim()
    if (same) li.classList.add('is-same')

    const head = document.createElement('div')
    head.className = 'step-head'
    const label = document.createElement('b')
    label.textContent = step.label
    const note = document.createElement('span')
    note.className = 'muted'
    note.textContent = same ? `${step.note} Nothing to change here.` : step.note
    head.append(label, note)

    const body = document.createElement('code')
    body.className = 'code'
    body.append(code(step.output))

    li.append(head, body)
    els.stepList.append(li)
  }

  if (result.error) {
    const li = document.createElement('li')
    li.className = 'step is-error'
    li.textContent = result.error.message
    els.stepList.append(li)
  }
}

function renderGrammars(result, code) {
  if (!result.grammars.length) {
    const li = document.createElement('li')
    li.className = 'muted'
    li.textContent = 'No grammar is used: the query runs as plain JavaScript.'
    els.grammarList.append(li)
    return
  }

  for (const grammar of result.grammars) {
    const li = document.createElement('li')
    li.className = 'grammar'

    const head = document.createElement('div')
    head.className = 'grammar-head'
    const name = chip(grammar.key, result)
    const outcome = evaluate(result, grammar.key)
    const value = document.createElement('span')
    value.className = `value is-${outcome.kind}`
    value.textContent = outcome.text
    value.title = outcome.text
    head.append(name, value)

    const match = document.createElement('code')
    match.className = 'code grammar-match'
    match.append(code(grammar.match.trim()))

    const lexemes = document.createElement('dl')
    lexemes.className = 'lexemes'
    for (const [lexeme, text] of Object.entries(grammar.lexemes)) {
      if (text === undefined) continue
      const dt = document.createElement('dt')
      dt.textContent = lexeme
      const dd = document.createElement('dd')
      dd.append(code(text))
      lexemes.append(dt, dd)
    }

    const output = document.createElement('code')
    output.className = 'code grammar-code'
    output.append(code(result.expand(grammar.key)))

    li.append(head, match, lexemes, output)
    els.grammarList.append(li)
  }
}

function renderDictionary(result, code) {
  if (!result.entries.length) {
    const caption = document.createElement('caption')
    caption.className = 'empty'
    caption.textContent = 'Empty: the query has no strings, calls or grammars.'
    els.dictionary.append(caption)
    return
  }

  const head = document.createElement('thead')
  head.innerHTML = '<tr><th scope="col">key</th><th scope="col">from</th><th scope="col">value</th><th scope="col">gives for the item</th></tr>'
  const body = document.createElement('tbody')
  for (const [key, value] of result.entries) {
    const atom = result.atoms.get(key)
    const tr = document.createElement('tr')
    tr.dataset.key = key
    const keyCell = document.createElement('td')
    keyCell.append(chip(key, result))
    const kindCell = document.createElement('td')
    kindCell.className = 'muted'
    kindCell.textContent = (KINDS[atom?.kind] ?? '') + (atom?.unquoted ? ', unquoted' : '')
    const valueCell = document.createElement('td')
    valueCell.className = 'code'
    valueCell.append(code(value))
    // an unquoted value is a piece of a template string, not an expression of its own
    const givesCell = document.createElement('td')
    if (!atom?.unquoted) {
      const outcome = evaluate(result, key)
      const badge = document.createElement('span')
      badge.className = `value is-${outcome.kind}`
      badge.textContent = outcome.text
      badge.title = outcome.text
      givesCell.append(badge)
    }
    tr.append(keyCell, kindCell, valueCell, givesCell)
    body.append(tr)
  }
  els.dictionary.append(head, body)
}

// Hovering a chip lights up the same key everywhere on the tab.
function initLinking() {
  let linked = []
  const clear = () => {
    for (const el of linked) el.classList.remove('is-linked')
    linked = []
  }
  els.panels.item.addEventListener('mouseover', (event) => {
    const target = event.target.closest('.atom')
    clear()
    if (!target) return
    linked = [...els.panels.item.querySelectorAll(`[data-key="${target.dataset.key}"]`)]
    for (const el of linked) el.classList.add('is-linked')
  })
  els.panels.item.addEventListener('mouseleave', clear)
}

// ---------- item and functions editors ----------

function checkItem() {
  const result = parseItem(els.itemInput.value)
  item = result.item ?? null
  if (result.error) setStatus(els.itemCheck, result.error, 'error')
  else setStatus(els.itemCheck, `${Object.keys(item).length} keys.`, 'ok')
}

function renderItemPick() {
  const first = els.itemPick.options[0]
  els.itemPick.replaceChildren(first)
  data.forEach((row, index) => {
    const option = document.createElement('option')
    option.value = String(index)
    const title = formatCell(row[columns[0]]).text
    option.textContent = `${index + 1}. ${title.length > 40 ? title.slice(0, 39) + '…' : title}`
    els.itemPick.append(option)
  })
}

function setItemText(text) {
  els.itemInput.value = text
  storage.set('item', text)
  checkItem()
}

function initItem() {
  setItemText(storage.get('item') ?? JSON.stringify(SAMPLE_DATA[0], null, 2))
  els.itemInput.addEventListener('input', () => {
    storage.set('item', els.itemInput.value)
    checkItem()
    scheduleRun()
  })
  els.itemPick.addEventListener('change', () => {
    const row = data[Number(els.itemPick.value)]
    els.itemPick.value = ''
    if (!row) return
    setItemText(JSON.stringify(row, null, 2))
    run()
  })
  els.showFunction.checked = storage.get('show-function') === 'true'
  els.showFunction.addEventListener('change', () => {
    storage.set('show-function', String(els.showFunction.checked))
    run()
  })
  els.hideGuards.checked = storage.get('hide-guards') === 'true'
  els.hideGuards.addEventListener('change', () => {
    storage.set('hide-guards', String(els.hideGuards.checked))
    run()
  })
}

function checkFunctions() {
  const result = parseFunctions(els.functionsInput.value)
  functions = result.functions ?? null
  // the summary stays visible when the editor is closed, so it reports the error as well
  els.functionsNames.textContent = functions ? Object.keys(functions).map((name) => `${name}()`).join(', ') : result.error
  els.functionsNames.classList.toggle('is-error', !functions)
  setStatus(els.functionsCheck, result.error ?? '', result.error ? 'error' : '')
}

function initFunctions() {
  els.functionsInput.value = storage.get('functions') ?? SAMPLE_FUNCTIONS
  checkFunctions()
  els.functionsInput.addEventListener('input', () => {
    storage.set('functions', els.functionsInput.value)
    checkFunctions()
    scheduleRun()
  })
}

// ---------- tabs ----------

function setView(next, { focus = false } = {}) {
  view = VIEWS.includes(next) ? next : 'data'
  for (const name of VIEWS) {
    const selected = name === view
    els.tabs[name].setAttribute('aria-selected', String(selected))
    els.tabs[name].tabIndex = selected ? 0 : -1
    els.panels[name].hidden = !selected
  }
  if (focus) els.tabs[view].focus()
  storage.set('view', view)
}

function initTabs() {
  setView(viewFromHash() ?? storage.get('view') ?? 'data')
  for (const name of VIEWS) {
    els.tabs[name].addEventListener('click', () => {
      setView(name)
      run()
    })
    els.tabs[name].addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = VIEWS.indexOf(view) + (event.key === 'ArrowRight' ? 1 : -1)
      setView(VIEWS[(index + VIEWS.length) % VIEWS.length], { focus: true })
      run()
    })
  }
}

// ---------- data dialog ----------

let pending = null // rows parsed from the dialog, ready to be set

function checkDialogInput() {
  const result = parseData(els.dataInput.value)
  if (result.error) {
    pending = null
    setStatus(els.dataCheck, result.error, 'error')
  } else if (!result.rows.length) {
    pending = null
    setStatus(els.dataCheck, 'No objects found.', 'error')
  } else {
    pending = result.rows
    const n = result.rows.length
    setStatus(els.dataCheck, `${result.format}: ${n} ${n === 1 ? 'row' : 'rows'} ready.`, 'ok')
  }
  els.setData.disabled = !pending
}

function initDataDialog() {
  els.openData.addEventListener('click', () => {
    els.dataInput.value = dataText ?? JSON.stringify(data, null, 2)
    checkDialogInput()
    els.dialog.showModal()
    els.dataInput.focus()
    els.dataInput.setSelectionRange(0, 0)
    els.dataInput.scrollTop = 0
  })

  els.dataInput.addEventListener('input', checkDialogInput)

  els.dialog.addEventListener('close', () => {
    if (els.dialog.returnValue !== 'set' || !pending) return
    const text = els.dataInput.value
    storage.set('data', text)
    applyData(pending, text)
    pending = null
    run()
    els.openData.focus()
  })

  els.resetData.addEventListener('click', () => {
    storage.remove('data')
    applyData(SAMPLE_DATA, null)
    run()
    els.dialog.close('reset')
    els.openData.focus()
  })
}

function loadSavedData() {
  const saved = storage.get('data')
  if (saved) {
    const result = parseData(saved)
    if (!result.error && result.rows.length) return applyData(result.rows, saved)
    storage.remove('data')
  }
  applyData(SAMPLE_DATA, null)
}

// ---------- query, examples, settings ----------

const hashParams = () => new URLSearchParams(location.hash.slice(1))
const queryFromHash = () => hashParams().get('q')
const viewFromHash = () => hashParams().get('view')

function writeHash(query) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (view !== 'data') params.set('view', view)
  const url = new URL(location.href)
  url.hash = params.toString()
  history.replaceState(null, '', url.hash ? url.href : url.href.replace(/#$/, ''))
}

function initQuery() {
  els.query.value = queryFromHash() ?? EXAMPLES[0]
  els.query.addEventListener('input', scheduleRun)
  els.query.addEventListener('keydown', (event) => {
    // Enter runs immediately; Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      run()
    }
  })
  window.addEventListener('hashchange', () => {
    const q = queryFromHash()
    const nextView = viewFromHash() ?? 'data'
    if ((q !== null && q !== els.query.value.trim()) || nextView !== view) {
      if (q !== null) els.query.value = q
      setView(nextView)
      run()
    }
  })

  for (const query of EXAMPLES) {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = query
    btn.dataset.query = query
    btn.setAttribute('aria-pressed', 'false')
    btn.addEventListener('click', () => {
      els.query.value = query
      run()
    })
    li.append(btn)
    els.examples.append(li)
  }
}

function initSettings() {
  try {
    const saved = JSON.parse(storage.get('settings') || '{}')
    for (const name of SETTINGS) if (typeof saved[name] === 'boolean') $(name).checked = saved[name]
    if (typeof saved.nodeName === 'string') els.nodeName.value = saved.nodeName
  } catch { /* ignore broken value */ }

  const save = () => storage.set('settings', JSON.stringify(readSettings()))
  for (const name of SETTINGS) {
    $(name).addEventListener('change', () => {
      save()
      run()
    })
  }
  els.nodeName.addEventListener('input', () => {
    save()
    scheduleRun()
  })
  els.onlyMatches.addEventListener('change', run)
}

// ---------- start ----------

async function main() {
  initQuery()
  initSettings()
  initFunctions()
  initDataDialog()
  loadSavedData()
  initItem()
  initTabs()
  initLinking()

  try {
    QLF = await loadQLF()
    run()
  } catch (error) {
    setStatus(els.status, error.message, 'error')
  }
}

async function loadQLF() {
  const preferred = new URLSearchParams(location.search).get('cdn')
  const order = CDNS
    .filter((cdn) => !cdn.onlyWhenAsked || cdn.id === preferred)
    .sort((a, b) => (b.id === preferred) - (a.id === preferred))
  const failures = []
  for (const cdn of order) {
    try {
      const mod = await import(cdn.url)
      if (typeof mod.QLF !== 'function') throw new Error('no QLF export')
      els.cdnLink.textContent = cdn.name
      els.cdnLink.href = cdn.page
      if (cdn.id === 'local') $('cdn-note').textContent = ' of this repository: npm run build updates it'
      return mod.QLF
    } catch (error) {
      failures.push(`${cdn.name}: ${error.message}`)
    }
  }
  throw new Error(`Could not load qlf. ${failures.join('; ')}`)
}

main()
