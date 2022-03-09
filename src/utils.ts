export function splitChain(chain: string): Array<string> {
    return chain.split(/\W/).filter(Boolean)
}

const surround = item => `['${item}']`
export function joinChain([head, ...tail]: Array<string>, surroundHead: boolean = false): string {
    if (surroundHead) head = surround(head)
    return [head, ...tail.map(surround)].join('?.')
}

export function regexpToString(re: RegExp, backslash = true): string {
    let string = re.toString().slice(1, -(re.flags.length + 1))
    if (backslash) string = string.replaceAll('\\', '\\\\')
    return string
}