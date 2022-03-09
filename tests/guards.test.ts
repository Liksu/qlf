import {Guards, tieLexeme} from "../src/guards"
import JestMatchers = jest.JestMatchers;

function expects(guard: string, expression: any): JestMatchers<any>;
function expects(guard: string, expression: any, expected: any): void;

function expects(guard, expression, expected = null) {
    const result = Guards[guard](expression)
    console.log(`${guard}(${expression}) ==> ${result}`)
    const expectation = expect(result)
    if (arguments.length === 3) {
        return expectation.toBe(expected)
    }
    return expectation
}

const dictionaryKey = 'Ϙλφ11'

test('quote', () => {
    const quote = expects.bind(null, 'quote')
    quote('a', `'a'`)
    quote('"a"', `"a"`)
    quote(`'a'`, `'a'`)
    quote(dictionaryKey, dictionaryKey)
})

test('unquote', () => {
    const unquote = expects.bind(null, 'unquote')
    unquote(42, 42)
    unquote('a', 'a')
    unquote('"a"', '"a"')
    unquote(dictionaryKey, `${dictionaryKey}_quotation_free`)
})

test('safeVariable', () => {
    const safeVariable = expects.bind(null, 'safeVariable')
    safeVariable('null', 'null')
    safeVariable(42, 42)
    safeVariable(dictionaryKey, dictionaryKey)
    safeVariable(`'foo bar'`, `'foo bar'`)
    safeVariable(`"foo 'bar'"`, `"foo 'bar'"`)
    safeVariable(' foo ', `(typeof foo === 'undefined' ? 'foo' : foo)`)
    safeVariable('foo.bar', `(typeof foo.bar === 'undefined' ? 'foo.bar' : foo.bar)`)
})

test('commonGuard', () => {
    const commonGuard = expects.bind(null, 'commonGuard')
    commonGuard('item', `(typeof item === 'undefined' ? 'item' : item)`)
    commonGuard('item.foo', `(typeof item === 'undefined' ? 'item' : item)?.['foo']`)
    commonGuard('item[42]', `(typeof item === 'undefined' ? 'item' : item)?.['42']`)
    commonGuard('item.foo[42][baz].bar', `(typeof item === 'undefined' ? 'item' : item)?.['foo']?.['42']?.['baz']?.['bar']`)
    commonGuard('item.foo[42]["baz"].bar', `(typeof item === 'undefined' ? 'item' : item)?.['foo']?.['42']?.['baz']?.['bar']`)
})

test('headlessCommonGuard', () => {
    const headlessCommonGuard = expects.bind(null, 'headlessCommonGuard')
    headlessCommonGuard('item', `item`)
    headlessCommonGuard('item.foo', `item?.['foo']`)
    headlessCommonGuard('item[42]', `item?.['42']`)
    headlessCommonGuard('item.foo[42][baz].bar', `item?.['foo']?.['42']?.['baz']?.['bar']`)
    headlessCommonGuard('item.foo[42]["baz"].bar', `item?.['foo']?.['42']?.['baz']?.['bar']`)
})

test('safeArrayName', () => {
    const safeArrayName = expects.bind(null, 'safeArrayName')
    safeArrayName('foo', `(typeof foo !== 'undefined' && foo instanceof Array ? foo : [null])`)
    safeArrayName('foo.foo[42]["baz"].bar', `(typeof foo !== 'undefined' && foo instanceof Array ? foo : [null])`)
})

test('safeList', () => {
    const safeList = expects.bind(null, 'safeList')
    safeList(`42, 'a',foo`, `42, 'a', (typeof foo === 'undefined' ? 'foo' : foo)`)
    safeList(`42, 'a',foo.bar`, `42, 'a', (typeof foo === 'undefined' ? 'foo' : foo)?.['bar']`)
})

test('tieLexeme', () => {
    const fixCode = tieLexeme('key', 'item')
    expect(fixCode.call({key: 'foo.bar'}, 'key.some(item => item)'))
        .toBe(`key.some(item => item?.['bar'])`)
})