import {QLFDictionary} from "../src/dictionary";
import {qlfDictionaryKey} from "../src/interfaces";

const dictionary = new QLFDictionary()
const queryBefore = `Some 'text' with "quotation's 'mark'"`
const queryAfter = 'Some Ϙλφ1 with Ϙλφ3'

test('Correct regexp', () => {
    expect(QLFDictionary.keyRe).toStrictEqual(/Ϙλφ\d+/)
})

test('markUnquoted', () => {
    expect(QLFDictionary.markUnquoted('foo' as qlfDictionaryKey)).toBe('foo_quotation_free')
})

test('Correct regexp checker', () => {
    expect(QLFDictionary.isKeyRe).toStrictEqual(/^Ϙλφ\d+$/)
})

test('Check isKey', () => {
    expect(QLFDictionary.isKey('Ϙλφ1')).toBe(true)
    expect(QLFDictionary.isKey('Ϙλφa')).toBe(false)
    expect(QLFDictionary.isKey('qlf1')).toBe(false)
})

test('Save value', () => {
    dictionary.save('foo')
    expect(dictionary.size).toBe(1)
    expect(Array.from(dictionary.keys())).toStrictEqual(['Ϙλφ1'])
    expect(Array.from(dictionary.values())).toStrictEqual(['foo'])

    dictionary.save('"bar"', 'bar')
    expect(dictionary.size).toBe(3)
    expect(Array.from(dictionary.keys())).toStrictEqual(['Ϙλφ1', 'Ϙλφ2_quotation_free', 'Ϙλφ2'])
    expect(Array.from(dictionary.values())).toStrictEqual(['foo', 'bar', '"bar"'])
})

test('Reset', () => {
    dictionary.reset()
    expect(dictionary.size).toBe(0)
    expect(Array.from(dictionary.entries())).toStrictEqual([])
})

test('Extract all quoted substrings', () => {
    const result = dictionary.extractQuoted(queryBefore)
    // #3 because storing '"text"' and 'text' took two first indexes
    expect(result).toBe(queryAfter)
    expect(Array.from(dictionary.entries())).toStrictEqual([
        ['Ϙλφ1_quotation_free', 'text'],
        ['Ϙλφ1', `'text'`],
        ['Ϙλφ3_quotation_free', `quotation's 'mark'`],
        ['Ϙλφ3', `"quotation's 'mark'"`]
    ])
})

test('Restore all quoted strings', () => {
    expect(dictionary.restore(queryAfter)).toBe(queryBefore)
})
test('Extract empty quoted strings', () => {
    const dict = new QLFDictionary()
    expect(dict.extractQuoted(`a = "" and b = 'x' or c = ''`)).toBe('a = Ϙλφ1 and b = Ϙλφ3 or c = Ϙλφ5')
    expect(dict.get('Ϙλφ1' as qlfDictionaryKey)).toBe('""')
    expect(dict.get('Ϙλφ1_quotation_free' as qlfDictionaryKey)).toBe('')
    expect(dict.get('Ϙλφ3' as qlfDictionaryKey)).toBe(`'x'`)
    expect(dict.get('Ϙλφ5' as qlfDictionaryKey)).toBe(`''`)
})

test('Restore whole keys only', () => {
    const dict = new QLFDictionary()
    const query = `a in ("a", "b", "c", "d", "e", "f")`
    const extracted = dict.extractQuoted(query)
    expect(extracted).toBe('a in (Ϙλφ1, Ϙλφ3, Ϙλφ5, Ϙλφ7, Ϙλφ9, Ϙλφ11)')
    expect(dict.restore(extracted)).toBe(query)
    expect(dict.restore('Ϙλφ11_quotation_free Ϙλφ1_quotation_free')).toBe('f a')
})

test('Restore values as is', () => {
    const dict = new QLFDictionary()
    const query = `a = "$& $1 $\`" and b = '100%'`
    expect(dict.restore(dict.extractQuoted(query))).toBe(query)
})

test('Restore nested values', () => {
    const dict = new QLFDictionary()
    const inner = dict.save('"foo"', 'foo')
    const outer = dict.save(`[${inner}].includes(a)`)
    expect(dict.restore(`${outer} && true`)).toBe('["foo"].includes(a) && true')
})

test('Extract calls of known functions', () => {
    const dict = new QLFDictionary()
    const functionNames = ['getSprint', 'today', '$id']
    const guard = (args: string) => args.toUpperCase()

    expect(dict.extractCalls('a = getSprint(due, 1) and b > today() or unknown(c)', functionNames, guard))
        .toBe('a = Ϙλφ1 and b > Ϙλφ3 or unknown(c)')
    expect(dict.get('Ϙλφ1' as qlfDictionaryKey)).toBe('getSprint(DUE, 1)')
    expect(dict.get('Ϙλφ1_quotation_free' as qlfDictionaryKey)).toBe('${getSprint(DUE, 1)}')
    expect(dict.get('Ϙλφ3' as qlfDictionaryKey)).toBe('today()')

    // only the whole name, and the name with special character
    expect(dict.extractCalls('mytoday() = $id(a)', functionNames)).toBe('mytoday() = Ϙλφ5')
    expect(dict.get('Ϙλφ5' as qlfDictionaryKey)).toBe('$id(a)')
})

test('Extract nested calls', () => {
    const dict = new QLFDictionary()
    const extracted = dict.extractCalls('getSprint(today())', ['getSprint', 'today'])
    expect(extracted).toBe('Ϙλφ3')
    expect(dict.restore(extracted)).toBe('getSprint(today())')
})

test('Nothing to extract without functions', () => {
    const dict = new QLFDictionary()
    expect(dict.extractCalls('a = today()', [])).toBe('a = today()')
    expect(dict.size).toBe(0)
})
