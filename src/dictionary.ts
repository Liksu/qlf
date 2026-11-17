/**
 * Container to keep processed and extracted parts of query
 */
import {regexpToString} from "./utils";
import {qlfDictionaryKey} from "./interfaces";

export class QLFDictionary extends Map<qlfDictionaryKey, string> {
    static prefix = 'Ϙλφ'
    static keyRe = RegExp(`${QLFDictionary.prefix}\\d+`)
    static maxDepth = 42
    static unquotedSuffix = '_quotation_free'
    static markUnquoted = (key: qlfDictionaryKey): qlfDictionaryKey => `${key}${QLFDictionary.unquotedSuffix}`

    static isKeyRe = new RegExp('^' + regexpToString(QLFDictionary.keyRe, false) + '$')
    // a whole key with its optional suffix, to never take Ϙλφ1 for a part of Ϙλφ11
    static wholeKeyRe = new RegExp(`${regexpToString(QLFDictionary.keyRe, false)}(?:${QLFDictionary.unquotedSuffix})?`, 'g')

    public reset() {
        this.clear()
    }

    public save(value: string, unquotedValue?: string): qlfDictionaryKey {
        const dictionaryKey = this.getNextKey()

        if (unquotedValue != null) {
            this.set(QLFDictionary.markUnquoted(dictionaryKey), unquotedValue)
        }
        this.set(dictionaryKey, value)

        return dictionaryKey
    }

    public extractQuoted(input: string): string {
        return input.replace(
            /(['"])([\s\S]*?)\1/g,
            (quoted, quoteChar, unquoted) => this.save(quoted, unquoted)
        )
    }

    /**
     * Extract calls of known functions, so that for grammars a call is a single value, like a quoted string:
     * getSprint(duedate) ==> Ϙλφ5
     * The unquoted version of a call is its placeholder for template strings: ${getSprint(duedate)}
     *
     * @param {String} input
     * @param {Array<String>} functionNames
     * @param {Function} guardArguments - an extracted call is not processed anymore, so protect its arguments here
     */
    public extractCalls(
        input: string,
        functionNames: Array<string>,
        guardArguments: (args: string) => string = args => args
    ): string {
        if (!functionNames.length) return input

        const names = functionNames.map(name => name.replaceAll('$', '\\$')).join('|')
        const callRe = RegExp(`(?<![\\w$])(${names})\\(([^()]*)\\)`, 'g')

        let output = input
        do {
            input = output
            output = input.replace(callRe, (call, name, args) => {
                const code = `${name}(${guardArguments(args)})`
                return this.save(code, '${' + code + '}')
            })
        } while (output !== input) // nested calls, the inner ones first

        return output
    }

    /**
     * Restore all values from dictionary into the passed string
     * The values can contain keys as well, so repeat until nothing left
     * @param {String} input
     */
    public restore(input: string): string {
        let depthCounter = QLFDictionary.maxDepth
        while (QLFDictionary.keyRe.test(input) && --depthCounter) {
            input = input.replace(QLFDictionary.wholeKeyRe, key => this.get(key as qlfDictionaryKey) ?? key)
        }
        return input
    }

    /**
     * Note: when you'll save both quoted and unquoted strings, the key will be increased on two because of size value used
     */
    public getNextKey(): qlfDictionaryKey {
        return `${QLFDictionary.prefix}${this.size + 1}`
    }

    static isKey(string: string): boolean {
        return QLFDictionary.isKeyRe.test(string)
    }
}