import {joinChain, regexpToString, splitChain} from "../src/utils";

test('splitChain', () => {
    expect(splitChain('foo'))
        .toEqual(['foo'])

    expect(splitChain('foo.bar'))
        .toEqual(['foo', 'bar'])

    expect(splitChain('foo[42]'))
        .toEqual(['foo', '42'])

    expect(splitChain('foo["bar"]'))
        .toEqual(['foo', 'bar'])

    expect(splitChain('item.foo[42][baz]?.bar'))
        .toEqual(['item', 'foo', '42', 'baz', 'bar'])

    expect(splitChain(`item.foo['42']["baz"]?.bar`))
        .toEqual(['item', 'foo', '42', 'baz', 'bar'])
})

test('joinChain', () => {
    expect(joinChain(['item']))
        .toBe(`item`)

    expect(joinChain(['item'], true))
        .toBe(`['item']`)

    expect(joinChain(['item', 'foo', '42', 'baz', 'bar']))
        .toBe(`item?.['foo']?.['42']?.['baz']?.['bar']`)

    expect(joinChain(['item', 'foo', '42', 'baz', 'bar'], true))
        .toBe(`['item']?.['foo']?.['42']?.['baz']?.['bar']`)
})

test('regexpToString', () => {
    expect(regexpToString(/foo/))
        .toBe('foo')

    expect(regexpToString(/^foo$/))
        .toBe('^foo$')

    expect(regexpToString(/f\wo/))
        .toBe('f\\\\wo')

    expect(regexpToString(/f\wo/, false))
        .toBe('f\\wo')
})