// Follows one real transpile step by step.
// Nothing here reimplements qlf: internal methods of a single QLF instance are wrapped to record
// what goes in and out. A step that the loaded version of qlf does not have is simply not shown.

// dictionary keys, see QLFDictionary.prefix and markUnquoted
export const ATOM_RE = /Ϙλφ\d+(?:_quotation_free)?/g

// [instance, method, label, what the step does], in no particular order: steps are shown as they happen
const OBSERVED = [
  ['dictionary', 'extractQuoted', 'Strings', 'Quoted strings move to the dictionary, so nothing inside them is processed.'],
  ['qlf', 'replaceSynonyms', 'Synonyms', 'and, or, not (, ~ and = get the spelling that grammars and JavaScript understand.'],
  ['dictionary', 'extractCalls', 'Calls', 'Calls of functions move to the dictionary: for grammars a call is one value.'],
  ['qlf', 'processGrammars', 'Grammars', 'Each grammar becomes code, which is kept in the dictionary.'],
  ['qlf', 'guardWords', 'Words', 'Remaining words are guarded: a name the item does not have becomes a string.'],
  ['dictionary', 'restore', 'Code', 'The dictionary is expanded back. This is the JavaScript that runs for each item.'],
]

/**
 * @returns {{
 *   steps: Array<{label, note, input, output}>,
 *   atoms: Map<string, {kind, value, template?}>,
 *   grammars: Array<{template, match, lexemes, key}>,
 *   entries: Array<[string, string]>,
 *   filter: Function | null,
 *   error: Error | null,
 *   run: (context: object) => {value?, error?, calls: Array<{record: {params, text}, args, result?, error?}>},
 *   expand: (text: string) => string,
 *   compile: (code: string) => Function,
 * }}
 */
export function trace(QLF, settings, syntax, query) {
  const qlf = new QLF(settings, syntax)
  const dictionary = qlf.dictionary
  const instances = { qlf, dictionary }

  const steps = []
  const atoms = new Map()
  const grammars = []
  let depth = 0
  let stage = null

  // record only the outer call: guardWords is called for arguments of calls as well
  for (const [name, method, label, note] of OBSERVED) {
    const instance = instances[name]
    const original = instance?.[method]
    if (typeof original !== 'function') continue
    instance[method] = function (...args) {
      const outer = depth === 0
      const previousStage = stage
      if (outer) stage = label
      depth++
      try {
        const output = original.apply(this, args)
        if (outer) steps.push({ label, note, input: args[0], output })
        return output
      } finally {
        depth--
        stage = previousStage
      }
    }
  }

  // where each dictionary value comes from
  const save = dictionary.save
  const markUnquoted = dictionary.constructor.markUnquoted ?? ((key) => `${key}_quotation_free`)
  dictionary.save = function (value, unquotedValue) {
    const key = save.call(this, value, unquotedValue)
    atoms.set(key, { kind: stage, value })
    if (unquotedValue != null) atoms.set(markUnquoted(key), { kind: stage, value: unquotedValue, unquoted: true })
    return key
  }

  // which grammar matched what: same regexps, with a replace that remembers each match
  const compiled = qlf.syntax.compiledGrammars
  const grammarEntries = [...compiled]
  compiled.clear()
  for (const [re, grammar] of grammarEntries) {
    const tracer = new RegExp(re.source, re.flags)
    tracer[Symbol.replace] = (string, replacer) => RegExp.prototype[Symbol.replace].call(
      tracer,
      string,
      typeof replacer !== 'function' ? replacer : (...args) => {
        const key = replacer(...args)
        const template = grammar.initial
        const atom = atoms.get(key)
        if (atom) atom.template = template
        grammars.push({ template, match: args[0], lexemes: { ...args.at(-1) }, key })
        return key
      }
    )
    compiled.set(tracer, grammar)
  }

  // functions that qlf creates with new Function: their exact text, and every call while run() works
  let calls = null
  const recordCalls = (record, fn) => function (...args) {
    const call = { record, args }
    calls?.push(call)
    try {
      call.result = fn.apply(this, args)
      return call.result
    } catch (caught) {
      call.error = caught
      throw caught
    }
  }

  let filter = null
  let error = null
  try {
    filter = observeFunctions(recordCalls, () => qlf.transpile(query, { filterOnly: true }).filter)
  } catch (caught) {
    error = caught
  }

  // strict mode creates the function on the first call, so the call is observed as well
  const run = (context) => {
    calls = []
    const outcome = { calls }
    try {
      outcome.value = observeFunctions(recordCalls, () => filter(context))
    } catch (caught) {
      outcome.error = caught
    }
    calls = null
    return outcome
  }

  const restore = Object.getPrototypeOf(dictionary).restore // not the observed one
  const createFilter = settings.strictFilter ? qlf.createStrictFilterFunction : qlf.createSloppyFilterFunction

  return {
    steps,
    atoms,
    grammars,
    entries: [...dictionary],
    filter,
    error,
    run,
    expand: (text) => restore.call(dictionary, text),
    // the same function the query gets, for a part of the code
    compile: (code) => createFilter.call(qlf, code, { nodeName: qlf.settings?.nodeName ?? 'node' }),
  }
}

/**
 * Run the action while `new Function(...)` is observed: qlf looks the global Function up at the moment it
 * creates a function, so for this moment the global one is replaced with a proxy that keeps the created
 * function's text and returns the function wrapped by `wrap`
 */
function observeFunctions(wrap, action) {
  const original = globalThis.Function
  const create = (args) => {
    const fn = Reflect.construct(original, args)
    return wrap({ params: args.slice(0, -1).map(String), text: fn.toString() }, fn)
  }
  globalThis.Function = new Proxy(original, {
    construct: (target, args) => create(args),
    apply: (target, self, args) => create(args),
  })
  try {
    return action()
  } finally {
    globalThis.Function = original
  }
}

/**
 * Hide guards, for reading only: (typeof a === 'undefined' ? 'a' : a)?.['b'] ==> a.b
 */
export function unguard(code) {
  return code
    .replace(/\(typeof ([\w$]+) === 'undefined' \? '\1' : \1\)/g, '$1')
    .replace(/\(typeof ([\w$]+) !== 'undefined' && \1 instanceof Array \? \1 : \[null\]\)/g, '$1')
    .replace(/\?\.\['([A-Za-z_$][\w$]*)'\]/g, '.$1')
    .replace(/\?\.\['(\d+)'\]/g, '[$1]')
}
