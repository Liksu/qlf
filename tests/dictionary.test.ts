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