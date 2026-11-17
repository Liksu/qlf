import {QLF, Guards} from "../src/qlf";

const numbers = [{n: 1}, {n: 3}, {n: 5}]
const run = (query: string, strictFilter: boolean, data: object[] = numbers) =>
    data.filter(new QLF({strictFilter}).transpile(query).filter)

describe.each([true, false])('strictFilter: %s', (strictFilter) => {
    test.each([
        ['n >= 3', [3, 5]],
        ['n <= 3', [1, 3]],
        ['n > 3', [5]],
        ['n < 3', [1]],
        ['n = 3', [3]],
        ['n == 3', [3]],
        ['n === 3', [3]],
        ['n != 3', [1, 5]],
        ['n !== 3', [1, 5]],
        ['n>=3 and n<5', [3]],
    ])('comparison %s', (query, expected) => {
        expect(run(query, strictFilter).map((node: any) => node.n)).toStrictEqual(expected)
    })

    test.each([
        'n >== 3',
        'n <=== 3',
        'n !=== 3',
        'n = = 3',
        '(n = 3',
    ])('incorrect query %s is an error on transpile', (query) => {
        expect(() => new QLF({strictFilter}).transpile(query)).toThrow('Syntax error inside query')
    })

    test('arrow functions inside expressions are kept', () => {
        const data = [{tags: ['a', 'b']}, {tags: ['c']}]
        expect(run('tags.some(t => t == "c")', strictFilter, data)).toStrictEqual([{tags: ['c']}])
    })

    test.each([
        ['not (n = 3)', [1, 5]],
        ['NOT(n > 1 and n < 5)', [1, 5]],
        ['n > 1 and not (n = 5)', [3]],
        ['!(n = 3)', [1, 5]],
    ])('negation %s', (query, expected) => {
        expect(run(query, strictFilter).map((node: any) => node.n)).toStrictEqual(expected)
    })

    test('"not" inside grammars still works', () => {
        const data = [{s: 'a'}, {s: 'b'}]
        expect(run('s not in ("a")', strictFilter, data)).toStrictEqual([{s: 'b'}])
        expect(run('s not like "a"', strictFilter, data)).toStrictEqual([{s: 'b'}])
    })

    test('custom functions get their own values', () => {
        const qlf = new QLF({strictFilter}, {
            functions: {
                first: () => 'zzz',
                second: () => 'aaa',
            }
        })
        const data = [{v: 'zzz', w: 'aaa'}, {v: 'aaa', w: 'zzz'}]
        expect(data.filter(qlf.transpile('v = first() and w = second()').filter)).toStrictEqual([data[0]])
    })
})

test('Guards are exported from the package entry', () => {
    expect(typeof Guards.commonGuard).toBe('function')
})

describe.each([true, false])('unquoted values next to brackets, strictFilter: %s', (strictFilter) => {
    const data = [{s: 'Done', n: 1}, {s: 'New', n: 2}]
    const keys = (query: string) => data.filter(new QLF({strictFilter}).transpile(query).filter).map((node: any) => node.n)

    test.each([
        ['(s = Done)', [1]],
        ['!(s = Done)', [2]],
        ['not (s = Done)', [2]],
        ['(s = Done) or s = New', [1, 2]],
        ['(s = New or s = Done) and n > 1', [2]],
        ['((s = Done))', [1]],
    ])('%s', (query, expected) => {
        expect(keys(query)).toStrictEqual(expected)
    })
})

describe.each([true, false])('functions are values, strictFilter: %s', (strictFilter) => {
    const qlf = new QLF({strictFilter}, {
        functions: {
            openSprints: () => ['s1', 's2'],
            currentSprint: () => 's3',
            sprintsOf: (team: string, year: number) => team === 'core' && year === 2026 ? ['s2', 's3'] : [],
            getSprint: (date: string) => ({'2026-01-10': 's1', '2026-02-10': 's2', '2026-03-10': 's3'}[date] ?? null),
            prefix: () => 's',
            add: (a: number, b: number) => a + b,
        }
    })
    const data = [
        {sprint: 's1', tags: ['s1', 'x'], due: '2026-03-10', n: 1, sprints: ['s1', 's3'], main: 's1'},
        {sprint: 's2', tags: ['s1', 's2'], due: '2026-02-10', n: 2, sprints: ['s1'], main: 's1'},
        {sprint: 's3', tags: [], due: '2026-03-10', n: 3, sprints: [], main: 's3'},
        {sprint: '0', tags: ['y'], n: 4},
    ]
    const sprints = (query: string) => data.filter(qlf.transpile(query).filter).map(node => node.sprint)

    test.each([
        // functions with arguments: keys, values, expressions, other functions
        ['currentSprint() = getSprint(due)', ['s1', 's3']],
        ['sprint = getSprint(due)', ['s2', 's3']],
        ['sprint = getSprint("2026-01-10")', ['s1']],
        ['add(n, 1) > 3', ['s3', '0']],
        ['add(n + 1, add(n, 1)) > 6', ['s3', '0']],
        ['(sprint = getSprint(due) or n = 4)', ['s2', 's3', '0']],
        // a function as a value of a list, a list is flat
        ['sprint in (currentSprint(), "0")', ['s3', '0']],
        ['sprint in (openSprints())', ['s1', 's2']],
        ['sprint in (openSprints(), currentSprint())', ['s1', 's2', 's3']],
        ['sprint not in (openSprints(), "0")', ['s3']],
        ['sprint in (sprintsOf("core", 2026), getSprint(due))', ['s2', 's3']],
        ['tags has one of (openSprints())', ['s1', 's2']],
        ['tags has all of (openSprints())', ['s2']],
        // a function as a single value without parentheses
        ['sprint in openSprints()', ['s1', 's2']],
        ['sprint IN openSprints()', ['s1', 's2']],
        ['sprint not in openSprints()', ['s3', '0']],
        ['sprint in sprintsOf("core", 2026)', ['s2', 's3']],
        ['(sprint in openSprints() or sprint = s3)', ['s1', 's2', 's3']],
        // a function as a value of other grammars
        ['tags has currentSprint()', []],
        ['tags has getSprint(due)', ['s2']],
        ['sprint like prefix()', ['s1', 's2', 's3']],
        ['sprint starts with prefix()', ['s1', 's2', 's3']],
        ['sprint not ends with getSprint(due)', ['s1', '0']],
        // a function instead of a key
        ['getSprint(due) in (s1, s3)', ['s1', 's3']],
        ['getSprint(due) like "3"', ['s1', 's3']],
        ['getSprint(due) is null', ['0']],
        ['openSprints() has sprint', ['s1', 's2']],
    ])('%s', (query, expected) => {
        expect(sprints(query)).toStrictEqual(expected)
    })

    test.each([
        // a key that holds a list
        ['sprint in sprints', ['s1']],
        ['sprint not in sprints', ['s2', 's3', '0']],
        // a key that holds a single value, a word, a string, a number: the same as equality
        ['sprint in main', ['s1', 's3']],
        ['sprint in s2', ['s2']],
        ['sprint in "s2"', ['s2']],
        ['n in 2', ['s2']],
        ['sprint not in s2', ['s1', 's3', '0']],
    ])('single value without parentheses is not a function: %s', (query, expected) => {
        expect(sprints(query)).toStrictEqual(expected)
    })
})

describe.each([true, false])('the same grammar twice, strictFilter: %s', (strictFilter) => {
    const data = [{id: 1, s: 'a', p: 'b', t: ['x'], u: ['y']}, {id: 2, s: 'a', p: 'z', t: [], u: []}]
    const ids = (query: string) => data.filter(new QLF({strictFilter}).transpile(query).filter).map(node => node.id)

    test.each([
        ['s in ("a") and p in ("b")', [1]],
        ['t has x and u has y', [1]],
        ['s like a and p like b', [1]],
        ['s like a or p like b or p like z', [1, 2]],
    ])('%s', (query, expected) => {
        expect(ids(query)).toStrictEqual(expected)
    })
})

describe.each([true, false])('node name, strictFilter: %s', (strictFilter) => {
    const rows = [{id: 1, data: {id: 10, x: 1}}, {id: 2, data: {id: 20, x: 2}}]
    const ids = (query: string) => rows
        .filter(new QLF({strictFilter, nodeName: 'row.data'}).transpile(query).filter)
        .map(row => row.id)

    test('keys are taken from the node', () => {
        expect(ids('id = 20')).toStrictEqual([2])
        expect(ids('x = 1')).toStrictEqual([1])
    })

    test('head of the node name is the passed object', () => {
        expect(ids('row.id = 1')).toStrictEqual([1])
        expect(ids('row.data.id = 20')).toStrictEqual([2])
    })
})
