/**
 * Connects a request to its runtime's "keep alive" hook, e.g. the Workers
 * `ctx.waitUntil`. Runtime entries register it before calling `router.fetch`;
 * app code only sees a plain function. Without registration (Node dev server,
 * tests) background work simply runs as a detached promise.
 */
type WaitUntil = (promise: Promise<unknown>) => void

const registry = new WeakMap<Request, WaitUntil>()

export function registerWaitUntil(request: Request, waitUntil: WaitUntil) {
  registry.set(request, waitUntil)
}

export function getWaitUntil(request: Request): WaitUntil | undefined {
  return registry.get(request)
}
