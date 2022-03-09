import {QLF} from "../src/qlf";

const qlf = new QLF()

test('Transpile', () => {
    const fn = qlf.transpile('foo like "bar" and today()').filter
    console.log(fn.toString())
    const list = [{foo: 1, a: 1}, {bar: 2, a: 2}, {foo: 'Barsa', a: 3}, {foo: 'bar', a: 4}]
    const result = list.filter(fn).map(node => node.a)
    expect(result).toStrictEqual([3, 4])
})