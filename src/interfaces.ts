/**
 * known lexemes that should be processed in grammars
 */
export type qlfLexeme = 'code' | 'key' | 'value' | 'list'

/**
 * String that contains dictionary key - number with unique prefix
 */
export type qlfDictionaryKey = `${string}${number}` | `${string}${number}${string}`

/**
 * Type of filtering function that should check one node to fits the query
 */
export type qlfFilterFn = (node: object) => boolean

/**
 * Type of ordering function that receive all nodes and place them into the right order
 */
export type qlfSortFn = (nodes: Array<object>) => Array<object>

/**
 * Function that combines filtering and sorting
 */
export type qlfQueryFn = (nodes: Array<object>) => Array<object>

/**
 * dictionary to find lexemes
 */
export type qlfLexemes<T> = {
    [lexeme in qlfLexeme]?: T
} & {
    [lexeme: string]: T
}

/**
 * operator's synonyms that will be replaced with operators available in grammars
 */
export interface qlfSynonyms extends Map<RegExp, string> {}

/**
 * Function that protect found lexemes from errors like unknown keys or keys of undefined, etc
 * Anyway it is a function that receive found lexeme and grammar
 * and should return string that will be used in code instead of found lexeme
 */
export type qlfGuard = (lexeme: string) => string

/**
 * grammar's template is a string like 'key operator value|list', example 'key not in list',
 * where 'key', 'value' and 'list' are lexemes that will be found by according regexps
 * and replaced with 'code' using found parts
 * @example
 * having data node = {foo: 'bar'}
 * and grammar = {'key not in list': {code: '![list].includes(key)'}}
 * expression 'foo not in ("baz", 42)' will be recognized as template 'key not in list'
 * and replaced with code '!["baz", 42].includes(node.foo)'
 */
export interface qlfGrammar {
    code: string
    guards: qlfLexemes<qlfGuard>
    initial?: string // initial template value, will be added automatically if not configured
    title?: string
    description?: string
    example?: string | Array<string>
}

export interface qlfGrammars {
    [template: string]: qlfGrammar
}

export interface qlfFunctions {
    [name: string]: Function
}

export interface qlfSettings {
    caseSensitive?: boolean
    strictEquality?: boolean
    strictFilter?: boolean
    filterOnly?: boolean
    nodeName?: string
}

export interface qlfSyntax {
    lexemes?: qlfLexemes<RegExp>
    synonyms?: qlfSynonyms
    grammars?: qlfGrammars
    functions?: qlfFunctions
}

export interface qlfTranspileSettings extends Pick<qlfSettings, 'strictFilter' | 'nodeName' | 'filterOnly'>{
    cursorPosition?: number
}

export interface qlfFullResult {
    filter: qlfFilterFn
    sorter: qlfSortFn
    query: qlfQueryFn
    error: Error['message'] | null
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

export interface qlfShortResult extends Pick<qlfFullResult, 'filter' | 'error'> {}

export enum qlfErrors {
    Quotation = 'Incorrect quotation',
    Ordering = 'Incorrect ordering condition',
    Syntax = 'Syntax error inside query',
    Runtime = 'Runtime error during filtering',
    EmptyQuery = 'Empty query',
}
