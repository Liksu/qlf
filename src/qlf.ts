import { Syntax } from './syntax'
import {
    qlfErrors,
    qlfFilterFn,
    qlfFullResult,
    qlfLexemes,
    qlfSettings,
    qlfShortResult,
    qlfSyntax,
    qlfTranspileSettings
} from './interfaces'
import { QLFDictionary } from './dictionary'
import { Guards } from './guards'

export { Guards, tieLexeme } from './guards'
export * from './interfaces'

export class QLF {
    public syntax: Syntax
    private readonly settings: qlfSettings
    private readonly dictionary = new QLFDictionary()
    static defaultSettings: qlfSettings = {
        caseSensitive: false,
        strictEquality: false,
        strictFilter: true,
        filterOnly: false,
        nodeName: 'node'
    }

    constructor(settings?: qlfSettings, syntax?: qlfSyntax) {
        this.settings = {
            ...QLF.defaultSettings,
            ...settings
        }
        this.syntax = new Syntax(this.settings, syntax)
    }

    transpile(query: string, settings: qlfTranspileSettings = {}): qlfFullResult | qlfShortResult {
        this.dictionary.reset()

        const config: qlfTranspileSettings = {
            nodeName: this.settings.nodeName,
            filterOnly: this.settings.filterOnly,
            strictFilter: this.settings.strictFilter,
            ...settings
        }

        // extract quoted strings
        query = this.dictionary.extractQuoted(query)

        if (/['"]/.test(query)) throw Error(qlfErrors.Quotation)

        // split query to filter condition and sorting parts
        let [filterQuery, orderQuery, extraOrderingPart] = query.split(/\s+order by\s+/i).map(part => part.trim())

        if (extraOrderingPart) throw Error(qlfErrors.Ordering)
        if (!filterQuery && !orderQuery) throw Error(qlfErrors.EmptyQuery)

        let filter = this.prepareFilter(filterQuery, config)

        if (config.filterOnly) return {filter, error: null} as qlfShortResult

        // run filter fn with empty object to check runtime errors

        return {
            // selector // slice of data
            filter, // function that receive data node and return does it match query or not
            sorter: null, // function that sorts filtered results
            query: null, // function that receive whole dataset and process it combining filter, sorter, etc
            error: null, // if transpile fails, will contains the reason
            meta: { // additional info
                underCursor: { // to provide suggestion
                    // initial grammar's template from config
                    grammar: null,
                    // found lexemes group
                    key: null,
                    value: null,
                    list: null,
                },
                // input string that was split to found lexemes, operators, lists/values and joiners
                parts: [{string: null, position: null, type: null}]
            }
        }
    }

    private replaceSynonyms(query: string): string {
        this.syntax.synonyms.forEach((operator, synonym) => {
            query = query.replaceAll(synonym, ` ${operator} `)
        })

        return query
    }

    private processGrammars(query): string {
        this.syntax.compiledGrammars.forEach((grammar, templateRe) => {
            // replace each found grammar in query string with prepared code
            // in fact, with dictionary key that contains the prepared code
            query = query.replace(templateRe, (...args) => {
                // this code we'll modify during the processing of the query
                let code = grammar.code

                // object with found lexemes, like {key: 'foo', value: '42'}
                const lexemeValues = args.pop() as qlfLexemes<string>

                // if code guard specified, run it to protect using lexemes inside the code
                if (grammar.guards.code) {
                    code = grammar.guards.code.call(lexemeValues, code)
                }

                // for each found lexeme, replace it in the code with protected value
                // where the value is a substring from the query
                Object.entries(lexemeValues).forEach(([lexeme, value]) => {
                    const guard = grammar.guards[lexeme]
                    if (guard) value = guard(value)

                    code = code.replaceAll(lexeme, value)
                })

                // store prepared code and return dictionary key
                // to extract processed grammars from original query
                // and left there only unprocessed parts, operators and keys
                return this.dictionary.save(code)
            })
        })

        return query
    }

    /**
     * Find and protect unprocessed words: standalone or right inside brackets, like (status = Done)
     * but not function names foo(, parts of chains like foo.bar, or arrow function params (t) =>
     */
    private guardWords(query: string): string {
        return query.replace(
            /(?<=^|[\s(])\w+(?=[\s)]|$)(?!\s*\)?\s*=>)/g,
            word => Guards.commonGuard(word)
        )
    }

    private createSloppyFilterFunction(query: string, config: qlfTranspileSettings): qlfFilterFn {
        const safeNodeName = Guards.headlessCommonGuard(config.nodeName)
        const [headOfNodeName] = safeNodeName.split('?')
        const functions = this.syntax.functions
        const functionNames = Object.keys(functions)

        const filterFunctionBody = `if (!${headOfNodeName} || typeof ${safeNodeName} !== 'object') return;
        with (${config.nodeName}) {
          return ${query}
        }`;

        let filterFunction
        try {
            const fn = new Function(...functionNames, headOfNodeName, filterFunctionBody)
            filterFunction = fn.bind(null, ...functionNames.map(name => functions[name]))
            filterFunction.toString = () => fn.toString()
        } catch (error) {
            throw Error(`${qlfErrors.Syntax}: ${error.message}`)
        }

        return filterFunction
    }

    private createStrictFilterFunction(query: string, config: qlfTranspileSettings): qlfFilterFn {
        const safeNodeName = Guards.headlessCommonGuard(config.nodeName)
        const [headOfNodeName] = safeNodeName.split('?')

        // sort names, then take functions in the same order, so each name gets its own function
        const functionNames = Object.keys(this.syntax.functions).sort()
        const functions = functionNames.map(name => this.syntax.functions[name])
        const cache = new Map()
        const getNode = new Function(headOfNodeName, `return ${safeNodeName}`)

        // the query will be compiled later, for each set of node's keys, so check its syntax right now
        try {
            new Function(`return ${query}`)
        } catch (error) {
            throw Error(`${qlfErrors.Syntax}: ${error.message}`)
        }

        return function filterFn(context: any) {
            const node = getNode(context)
            if (!node || typeof node !== 'object') return
            const keys = Object.keys(node)
            const cacheKey = keys.join(',')

            if (!cache.has(cacheKey)) {
                try {
                    const compareFn = new Function(...functionNames, headOfNodeName, ...keys, `return ${query}`)
                    cache.set(cacheKey, compareFn)
                } catch (error) {
                    throw Error(`${qlfErrors.Syntax}: ${error.message}`)
                }
            }

            let result
            try {
                result = cache.get(cacheKey)(...functions, context, ...keys.map(key => node[key]))
            } catch (error) {
                throw Error(`${qlfErrors.Runtime}: ${error.message}`)
            }

            return result
        }
    }

    private prepareFilter(query: string, config: qlfTranspileSettings): qlfFilterFn {
        query = this.replaceSynonyms(query)

        // remove extra spaces
        query = query.replace(/\s+/g, ' ')

        // extract calls of functions: for grammars a call is a value, the same as a quoted string
        query = this.dictionary.extractCalls(
            query,
            Object.keys(this.syntax.functions),
            args => args.split(',').map(arg => this.guardWords(arg.trim())).join(', ')
        )

        query = this.processGrammars(query)

        query = this.guardWords(query)

        // expand all parts that was stored into the dictionary
        query = this.dictionary.restore(query)

        return config.strictFilter
            ? this.createStrictFilterFunction(query, config)
            : this.createSloppyFilterFunction(query, config)
    }
}