import {Syntax} from "./syntax";
import {
    qlfErrors,
    qlfFilterFn,
    qlfLexeme,
    qlfLexemes, qlfFullResult,
    qlfSettings,
    qlfSyntax,
    qlfTranspileSettings, qlfShortResult
} from "./interfaces";
import {QLFDictionary} from "./dictionary";
import {Guards} from "./guards";

export class QLF {
    public syntax: Syntax
    private readonly settings: qlfSettings
    private readonly dictionary = new QLFDictionary()
    static defaultSettings: qlfSettings = {
        caseSensitive: false,
        strictEquality: false,
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

    private createFilterFunction(query: string, config: qlfTranspileSettings): qlfFilterFn {
        const safeNodeName = Guards.headlessCommonGuard(config.nodeName)
        const [headOfNodeName] = safeNodeName.split('?')
        const functions = this.syntax.functions

        const filterFunctionBody = `if (!${headOfNodeName} || typeof ${safeNodeName} !== 'object') return;
        with (${config.nodeName}) {
          return ${query}
        }`;

        let filterFunction
        try {
            // @ts-ignore
            with (functions) {
                filterFunction = new Function(headOfNodeName, filterFunctionBody)
            }
        } catch (error) {
            console.log({filterFunctionBody})
            throw Error(`${qlfErrors.Syntax}: ${error.message}`)
        }

        return filterFunction
    }

    private prepareFilter(query: string, config: qlfTranspileSettings): qlfFilterFn {
        query = this.replaceSynonyms(query)

        // remove extra spaces
        query = query.replace(/\s+/g, ' ')

        query = this.processGrammars(query)

        // find and protect unprocessed words
        query = query.replace(
            /(^|\s)(\w+)(\s|$)/g,
            (match, before, word, after) => before + Guards.commonGuard(word) + after
        )

        // expand all parts that was stored into the dictionary
        query = this.dictionary.restore(query)

        return this.createFilterFunction(query, config)
    }
}