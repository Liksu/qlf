import {qlfFunctions, qlfGrammar, qlfGrammars, qlfLexemes, qlfSettings, qlfSynonyms, qlfSyntax} from "./interfaces";
import {Guards, tieLexeme} from "./guards";
import {regexpToString} from "./utils";

export class Syntax implements qlfSyntax {
    // use ignoreCase flag to mark lexemes that can NOT be processed as case-sensitive
    public lexemes: qlfLexemes<RegExp> = {
        key: /(?<key>[\wϘλφ.]+)/i, // property of object, or a function call stored in dictionary
        value: /(?<value>[\wϘλφ-]+)/, // value to compare, should include dictionary prefix
        list: /\((?<list>[^)]+)\)/i, // group of values inside parentheses
    }

    // synonyms reduce the variety of input: another spelling of what grammars and JS already understand
    public synonyms: qlfSynonyms = new Map([
        // joiners
        [/\bAND\b/gi, '&&'],
        [/\bOR\b/gi, '||'],
        [/\bNOT\s*(?=\()/gi, '!'], // negation of a group: not (...)
        // synonyms
        [/!~+/g, 'not contains'],
        [/~+/g, 'contains'],
        [/!==(?!=)/g, '!='],
        [/(?<![!<>=])=+(?!>)/g, '=='], // but not the = of !=, >=, <= and of arrow functions =>
    ])

    // a list is flattened, so a function that returns an array can be one of its values
    public grammars: qlfGrammars = {
        'key in list': {
            code: '[list].flat().includes(key)',
            guards: {
                list: Guards.safeList
            },
            description: `Search for key's content into a list of string encountered into parentheses`,
        },
        'key not in list': {
            code: '![list].flat().includes(key)',
            guards: {
                list: Guards.safeList
            },
            description: `Check that key's value is none of the values in parentheses`,
        },
        'key in value': {
            code: '[value].flat().includes(key)',
            guards: {
                value: Guards.safeVariable
            },
            description: `Same as key in list, but for the single value without parentheses: a function or a key that holds a list`,
        },
        'key not in value': {
            code: '![value].flat().includes(key)',
            guards: {
                value: Guards.safeVariable
            },
            description: `Same as key not in list, but for the single value without parentheses`,
        },
        'key has value': {
            code: 'key.some(item => item == value)',
            guards: {
                key: Guards.safeArrayName,
                value: Guards.safeVariable,
                code: tieLexeme('key', 'item'),
            },
            description: `Check that the array in key contains the value`,
        },
        'key has one of list': {
            code: 'key.some(item => [list].flat().includes(item))',
            guards: {
                key: Guards.safeArrayName,
                list: Guards.safeList,
                code: tieLexeme('key', 'item'),
            },
            description: `Check that the array in key contains at least one value from the list`,
        },
        'key has all of list': {
            code: '[list].flat().every(value => key.map(item => item).includes(value))',
            guards: {
                key: Guards.safeArrayName,
                list: Guards.safeList,
                code: tieLexeme('key', 'item'),
            },
            description: `Check that the array in key contains every value from the list`,
        },
        'key like value': {
            code: '/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Match key's value against the regular expression in value`,
        },
        'key contains value': {
            code: '/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Same as like`,
        },
        'key not like value': {
            code: '!/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Check that key's value does not match the regular expression in value`,
        },
        'key not contains value': {
            code: '!/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Same as not like`,
        },
        'key is null': {
            code: 'key == null',
            guards: {},
            description: `Check that key is null or undefined`,
        },
        'key is not null': {
            code: 'key != null',
            guards: {},
            description: `Check that key is neither null nor undefined`,
        },
        'key is empty': {
            code: 'key == ""',
            guards: {},
            description: `Check that key loosely equals an empty string, so 0, false and an empty array are empty as well`,
        },
        'key is not empty': {
            code: 'key != ""',
            guards: {},
            description: `Check that key does not loosely equal an empty string`,
        },
        'key starts with value': {
            code: '/^value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Check that key's value starts with the regular expression in value`,
        },
        'key not starts with value': {
            code: '!/^value/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Check that key's value does not start with the regular expression in value`,
        },
        'key ends with value': {
            code: '/value$/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Check that key's value ends with the regular expression in value`,
        },
        'key not ends with value': {
            code: '!/value$/.test(key)',
            guards: {
                value: Guards.unquote
            },
            description: `Check that key's value does not end with the regular expression in value`,
        },

    }

    public functions: qlfFunctions = {
        today: () => new Date().toLocaleDateString("sv")
    }

    public readonly compiledGrammars = new Map<RegExp, qlfGrammar>()

    constructor(settings: qlfSettings = {}, syntax?: qlfSyntax) {
        // add grammars, lexemes or functions
        if (syntax) {
            Object.keys(syntax).forEach(key => {
                if (!this[key]) this[key] = syntax[key]
                else if (syntax[key] instanceof Map) {
                    let mapFn = (value: unknown, mapKey: unknown) => this[key][mapKey] = value
                    if (this[key] instanceof Map) mapFn = (value, mapKey) => this[key].set(mapKey, value)
                    syntax[key].forEach(mapFn)
                }
                else Object.assign(this[key], syntax[key])
            })
        }


        this.compileGrammars(settings)
    }

    /**
     * Fills the compiledGrammars map with grammars with correct grammar's regexps as keys and
     * all other data including corrected code as value
     * @param settings
     */
    public compileGrammars(settings: qlfSettings = {}) {
        this.compiledGrammars.clear()

        const lexemesCompiler = this.getLexemesCompiler()
        const codeCompiler = this.getCodeCompiler(settings.caseSensitive, settings.strictEquality)

        Object.entries(this.grammars)
            .sort((a, b) => b[0].length - a[0].length)
            .forEach(([template, grammar]) => {
                grammar.code = codeCompiler(grammar.code)
                grammar.guards.key ??= Guards.commonGuard
                grammar.initial ??= template
                template = lexemesCompiler(template)

                // global, to process every place of the query where the grammar is used
                this.compiledGrammars.set(RegExp(template, 'gi'), grammar)
            })
    }

    /**
     * Prepare function that will replace all known lexemes into the grammar with according regexp
     * @private
     */
    private getLexemesCompiler(): Function {
        let fnBody = 'return input'

        Object.entries(this.lexemes)
            .forEach(([lexeme, regexp]) => {
                fnBody += `.replaceAll('${lexeme}', '${regexpToString(regexp)}')`
            })

        return new Function('input', fnBody)
    }


    /**
     * Prepare function that will replace all regexps in the code with case-sensitive regexp
     * and update equality to strict if needed
     * @param {Boolean} caseSensitive
     * @param {Boolean} strictEquality
     * @private
     */
    private getCodeCompiler(caseSensitive: boolean, strictEquality: boolean): Function {
        const caseFlag = caseSensitive ? '' : ', "i"'
        let fnBody = 'return input'

        Object.entries(this.lexemes)
            .filter(([lexeme, regexp]) => !regexp.ignoreCase)
            .forEach(([lexeme]) => {
                fnBody += `.replace(/\\/(\\^?${lexeme}\\$?)\\//gi, 'RegExp(\\\`$1\\\`${caseFlag})')`
            })

        if (strictEquality) {
            fnBody += `.replaceAll('==', '===').replaceAll('!=', '!==')`
        }

        return new Function('input', fnBody)
    }
}