/**
 * Container to keep processed and extracted parts of query
 */
import {regexpToString} from "./utils";
import {qlfDictionaryKey} from "./interfaces";

export class QLFDictionary extends Map<qlfDictionaryKey, string> {
    static prefix = 'Ϙλφ'
    static keyRe = RegExp(`${QLFDictionary.prefix}\\d+`)
    static maxDepth = 42
    static markUnquoted = (key: qlfDictionaryKey): qlfDictionaryKey => `${key}_quotation_free`

    static isKeyRe = new RegExp('^' + regexpToString(QLFDictionary.keyRe, false) + '$')

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
            /(['"])([^\1]+?)\1/g,
            (quoted, quoteChar, unquoted) => this.save(quoted, unquoted)
        )
    }

    /**
     * Restore all values from dictionary into the passed string
     * @param {String} input
     */
    public restore(input: string): string {
        let depthCounter = QLFDictionary.maxDepth
        while (QLFDictionary.keyRe.test(input) && --depthCounter) {
            this.forEach((value, key) => {
                input = decodeURI(input.replace(key, encodeURI(value)))
            })
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