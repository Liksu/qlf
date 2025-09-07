import {Syntax} from "../src/syntax";
import { QLF } from '../src/qlf'

const syntax = new Syntax()

describe('Lexemes', () => {
    test('Correct lexeme compiler', () => {
        const lexemesCompiler = syntax['getLexemesCompiler']()
        expect(lexemesCompiler('key like value'))
            .toBe('(?<key>[\\w.]+) like (?<value>[\\wϘλφ-]+)')
    })


    test('Adding custom synonyms', () => {
        const eqRe = /\bequals\b/gi

        // Test synonym functionality by checking if they get applied
        const qlf = new QLF({}, {
            synonyms: new Map([
                [eqRe, '=='],
                [/\bis\s+like\b/gi, 'like']
            ])
        })

        // Check that custom synonyms were added
        expect(qlf.syntax.synonyms.has(eqRe)).toBe(true) // custom synonym exists
        expect(qlf.syntax.synonyms.size).toBe(7) // original + custom synonyms
        expect(qlf['replaceSynonyms']('key equals value')).toContain('==') // custom synonym works
        expect(qlf['replaceSynonyms']('key is like value')).not.toContain('is')
        expect(qlf.syntax.synonyms.values().next().value).toBe('&&') // original synonym still exists
    })
})

describe('All grammars matches itself', () => {
    syntax.compiledGrammars.forEach((grammar, re) => {
        const template = grammar.initial.replaceAll('list', '(li, st)')
        test(grammar.initial, () => expect(re.test(template)).toBe(true))
    })
})

describe('Correct code compiler', () => {
    test('Case insensitive, non-strict equality', () => {
        const codeCompiler = syntax['getCodeCompiler'](false, false)
        expect(codeCompiler.toString()).toBe(`function anonymous(input
) {
return input.replace(/\\/(\\^?value\\$?)\\//gi, 'RegExp(\\\`$1\\\`, "i")')
}`)
    })

    test('Case insensitive, strict equality', () => {
        const codeCompiler = syntax['getCodeCompiler'](false, true)
        expect(codeCompiler.toString()).toBe(`function anonymous(input
) {
return input.replace(/\\/(\\^?value\\$?)\\//gi, 'RegExp(\\\`$1\\\`, "i")').replaceAll('==', '===').replaceAll('!=', '!==')
}`)
    })

    test('Case sensitive, non-strict equality', () => {
        const codeCompiler = syntax['getCodeCompiler'](true, false)
        expect(codeCompiler.toString()).toBe(`function anonymous(input
) {
return input.replace(/\\/(\\^?value\\$?)\\//gi, 'RegExp(\\\`$1\\\`)')
}`)
    })

    test('Case sensitive, strict equality', () => {
        const codeCompiler = syntax['getCodeCompiler'](true, true)
        expect(codeCompiler.toString()).toBe(`function anonymous(input
) {
return input.replace(/\\/(\\^?value\\$?)\\//gi, 'RegExp(\\\`$1\\\`)').replaceAll('==', '===').replaceAll('!=', '!==')
}`)
    })

    test('Additional lexeme with strict equality', () => {
        syntax.lexemes.key = /dummy/
        const codeCompiler = syntax['getCodeCompiler'](false, true)
        expect(codeCompiler.toString()).toBe(`function anonymous(input
) {
return input.replace(/\\/(\\^?key\\$?)\\//gi, 'RegExp(\\\`$1\\\`, "i")').replace(/\\/(\\^?value\\$?)\\//gi, 'RegExp(\\\`$1\\\`, "i")').replaceAll('==', '===').replaceAll('!=', '!==')
}`)
    })
})

test('Today function', () => {
    expect(syntax.functions.today()).toBe(new Date().toLocaleDateString("sv"))
})

test('Adding grammar in constructor', () => {
    const syntax = new Syntax({}, {grammars: {
            'test': {
                code: 'true',
                guards: {}
            }
        }})

    expect(syntax.grammars).toHaveProperty('test')

    const expectedObject = {code: 'true', guards: {key: function anonymous() {}}, initial: 'test'}
    expect(syntax.grammars.test.toString()).toBe(expectedObject.toString())
})
