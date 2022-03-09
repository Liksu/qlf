import {qlfFunctions, qlfGrammar, qlfGrammars, qlfLexemes, qlfSettings, qlfSynonyms, qlfSyntax} from "./interfaces";
import {Guards, tieLexeme} from "./guards";
import {regexpToString} from "./utils";

export class Syntax implements qlfSyntax {
    // use ignoreCase flag to mark lexemes that can NOT be processed as case-sensitive
    public lexemes: qlfLexemes<RegExp> = {
        key: /(?<key>[\w.]+)/i, // property of object
        value: /(?<value>[\wϘλφ-]+)/, // value to compare, should include dictionary prefix
        list: /\((?<list>[^)]+)\)/i, // group of values inside parentheses
    }

    public synonyms: qlfSynonyms = new Map([
        // joiners
        [/\bAND\b/gi, '&&'],
        [/\bOR\b/gi, '||'],
        // synonyms
        [/!~+/g, 'not contains'],
        [/~+/g, 'contains'],
        [/=+/g, '=='],
    ])

    public grammars: qlfGrammars = {
        'key in list': {
            code: '[list].includes(key)',
            guards: {
                list: Guards.safeList
            },
            description: `Search for key's content into a list of string encountered into parentheses`,
        },
        'key not in list': {
            code: '![list].includes(key)',
            guards: {
                list: Guards.safeList
            },
        },
        'key has value': {
            code: 'key.some(item => item == value)',
            guards: {
                key: Guards.safeArrayName,
                value: Guards.safeVariable,
                code: tieLexeme('key', 'item'),
            },
        },
        'key has one of list': {
            code: 'key.some(item => [list].includes(item))',
            guards: {
                key: Guards.safeArrayName,
                list: Guards.safeList,
                code: tieLexeme('key', 'item'),
            },
        },
        'key has all of list': {
            code: '[list].every(value => key.map(item => item).includes(value))',
            guards: {
                key: Guards.safeArrayName,
                list: Guards.safeList,
                code: tieLexeme('key', 'item'),
            },
        },
        'key like value': {
            code: '/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key contains value': {
            code: '/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key not like value': {
            code: '!/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key not contains value': {
            code: '!/value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key is null': {
            code: 'key == null',
            guards: {},
        },
        'key is not null': {
            code: 'key != null',
            guards: {},
        },
        'key is empty': {
            code: 'key == ""',
            guards: {},
        },
        'key is not empty': {
            code: 'key != ""',
            guards: {},
        },
        'key starts with value': {
            code: '/^value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key not starts with value': {
            code: '!/^value/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key ends with value': {
            code: '/value$/.test(key)',
            guards: {
                value: Guards.unquote
            },
        },
        'key not ends with value': {
            code: '!/value$/.test(key)',
            guards: {
                value: Guards.unquote
            },
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
                Object.assign(this[key], syntax[key])
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

                this.compiledGrammars.set(RegExp(template, 'i'), grammar)
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