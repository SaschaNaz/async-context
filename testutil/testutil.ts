import AsyncChainer from "../built/async-context";
let { AsyncFeed } = AsyncChainer;

export function waitFor(millisecond: number) {
    return new AsyncFeed((resolve, reject) => {
        setTimeout(() => resolve(), millisecond)
    })
}