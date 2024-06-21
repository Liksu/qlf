import {QLFDictionary} from "./dictionary";
import {qlfDictionaryKey, qlfGrammar, qlfGuard, qlfLexeme, qlfLexemes} from "./interfaces";
import {joinChain, splitChain} from "./utils";

export namespace Guards {
    /**
     * Check is variable null, number, dictionary key or quoted string
     * @param variable
     */
    const isSafe = (variable: string): boolean =>
        ['null', 'true', 'false', 'undefined'].includes(variable)
        || !isNaN(Number(variable)) // is number
        || QLFDictionary.isKey(variable) // is dictionary key
        || /^(['"]).+\1$/.test(variable) // has own quotation

    /**
     * Surrounds input value with quotation marks if needed
     *
     * @param value {String} - input string of dictionary key
     * @returns {String} - quoted value
     */
    export const quote: qlfGuard = (value: string): string =>
        QLFDictionary.isKey(value) || /^(['"]).+\1$/.test(value) ? value : `'${value}'`

    /**
     * Marks dictionary keys with suffix
     *
     * @param value {String}
     * @returns {String}
     */
    export const unquote: qlfGuard = (value: string): string =>
        QLFDictionary.isKey(value) ? QLFDictionary.markUnquoted(value as qlfDictionaryKey) : value

    /**
     * Unless variable exists, returns variable as string
     * except numbers and null
     *
     * @param variable {String} - any variable that can be in scope
     * @returns {String}
     */
    export const safeVariable: qlfGuard = (variable: string): string => {
        if (isSafe(variable)) return variable
        variable = variable.trim()
        return `(typeof ${variable} === 'undefined' ? '${variable}' : ${variable})`
    }

    /**
     * For any input such variable or array, protect first part as variable
     * and all other (if any) parts as object/array keys
     *
     * @example
     * 'foo' ==> `(typeof foo === 'undefined' ? 'foo' : foo)`
     * 'foo.bar' ==> `(typeof foo === 'undefined' ? 'foo' : foo)?.['bar']`
     *
     * @param key {String}
     * @returns {String} - safe key
     */
    export const commonGuard: qlfGuard = (key: string): string => {
        if (isSafe(key)) return key

        let [head, ...tail] = splitChain(key)
        head = safeVariable(head)
        return joinChain([head, ...tail])
    }

    /**
     * commonGuard for known variables where the head of expression does not need to be protected
     *
     * @param key {String}
     * @returns {String} - safe key
     */
    export const headlessCommonGuard: qlfGuard = (key: string): string => {
        return joinChain(splitChain(key))
    }

    /**
     * Allows to protect calling of array methods on key
     *
     * @param arrayExpression {String}
     * @returns {String}
     */
    export const safeArrayName: qlfGuard = (arrayExpression: string): string => {
        const [arrayName] = splitChain(arrayExpression)
        return `(typeof ${arrayName} !== 'undefined' && ${arrayName} instanceof Array ? ${arrayName} : [null])`
    }

    /**
     * Protect each item of comma separated list
     *
     * @param list {String}
     * @return {String} - safe list
     */
    export const safeList: qlfGuard = (list: string): string => {
        return list
            .split(/\s*,\s*/)
            .map(commonGuard)
            .join(', ')
    }
}

/**
 * Tie the `synonym` string from the grammar's code to fix function
 * This tying allows using the sub-functions in code where the body usage of lexeme will be safe
 * For example, it can be useful to get some deep values from the node to serial comparison
 *
 * @example
 * Grammars = {
 *     'key has value' : {
 *         code: 'key.some(item => item == value)',
 *         guards: {key: expression => expression.split('.')[0]} // will left only 'foo' as array name an examples below
 *     }
 * }
 *
 * Query = 'foo.bar has 42'
 * In this case we'll wait that node.foo contains an array of objects and we'll need to check is
 * there at least one object that contains bar equal to 42.
 * So we need to know what is the item in the code above and protect it from incorrect replacement
 * incorrect, no replacement - no deep lookup:
 *     foo.some(item => item == value)
 * incorrect for code 'key.some(item => key == value)', too much replacement:
 *     foo.some(item => foo == value)
 * correct:
 *     foo.some(item => item?.['bar'] === "42")
 *
 * @param lexeme {String} - lexeme name in found lexemes object
 * @param synonym {String} - name of variable into the grammar's code that needs to be fixed
 */
export const tieLexeme = (lexeme: qlfLexeme, synonym: string): qlfGuard => {
    /**
     * function that fixes code according to syntax grammar needs
     * @this {Object} - object that contains found in query lexemes with according values like {key: 'foo', list: 'a, b, c'}
     * @param code {String} - grammar's code
     */
    return function(this: qlfLexemes<string>, code: qlfGrammar["code"]): string {
        // we'll need the head only to replace synonym as argument
        const [head, ...tail] = splitChain(this[lexeme])
        // and whole protected lexeme value in all other places
        const safeLexeme = joinChain([synonym, ...tail])

        return code
            .replaceAll(new RegExp(`${synonym}\\s*=>\\s*`, 'g'), `${QLFDictionary.prefix} => `)
            .replaceAll(synonym, safeLexeme)
            .replaceAll(`${QLFDictionary.prefix} => `, `${synonym} => `)
    }
}