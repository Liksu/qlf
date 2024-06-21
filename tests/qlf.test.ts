import {QLF} from "../src/qlf";

const qlf = new QLF()

test('Transpile', () => {
    const fn = qlf.transpile('foo like "bar" and today()').filter
    console.log(fn.toString())
    const list = [{foo: 1, a: 1}, {bar: 2, a: 2}, {foo: 'Barsa', a: 3}, {foo: 'bar', a: 4}]
    const result = list.filter(fn).map(node => node.a)
    expect(result).toStrictEqual([3, 4])
})

test('Transpile deep', () => {
    const fn = new QLF({
        nodeName: 'item.a[0].c',
        strictFilter: false,
    }).transpile('foo = 42').filter
    const result = testData.filter(fn)
    expect(result.map(node => node.mark)).toStrictEqual(['example1', 'example7'])
})

test('Transpile deep', () => {
    const fn = new QLF({
        nodeName: 'item.a[0].c',
        strictFilter: true,
    }).transpile('foo = 42').filter
    const result = testData.filter(fn)
    expect(result.map(node => node.mark)).toStrictEqual(['example1', 'example7'])
})

const testData = [
    {
        a: [
            {
                c: {
                    foo: 42,
                    bar: 'baz'
                }
            }
        ],
        mark: 'example1'
    },
    {
        x: {
            y: {
                z: {
                    a: [
                        {
                            c: {
                                foo: 42
                            }
                        }
                    ]
                }
            }
        }, mark: 'example2',
    },
    {
        a: [
            {
                b: {
                    c: {
                        foo: 42,
                        extra: 'data'
                    }
                }
            }
        ],
        mark: 'example3'
    },
    {
        a: [
            {
                c: {
                    foo: 41,
                    bar: 'not42'
                }
            }
        ],
        d: 'example4'
    },
    {
        a: [
            {
                c: {
                    foo: 40,
                    bar: 'example'
                }
            }
        ],
        e: 'example5'
    },
    {
        f: {
            g: {
                h: [
                    {
                        c: {
                            foo: 42,
                            other: 'value'
                        }
                    }
                ]
            }
        },
        mark: 'example6'
    },
    {
        a: [
            {
                c: {
                    foo: 42,
                    bar: 'test'
                }
            }
        ],
        mark: 'example7'
    },
    {
        a: [
            {
                c: {
                    foo: 43,
                    bar: 'test'
                }
            }
        ],
        i: 'example8'
    },
    {
        j: {
            k: {
                l: {
                    a: [
                        {
                            c: {
                                foo: 42,
                                additional: 'info'
                            }
                        }
                    ]
                }
            }
        },
        mark: 'example9'
    },
    {
        m: {
            n: {
                o: [
                    {
                        p: {
                            c: {
                                foo: 44,
                                data: 'example'
                            }
                        }
                    }
                ]
            }
        },
        mark: 'example10'
    },
    {
        q: {
            r: {
                s: [
                    {
                        a: [
                            {
                                c: {
                                    foo: 42,
                                    bar: 'example'
                                }
                            }
                        ]
                    }
                ]
            }
        },
        mark: 'example11'
    }
]
