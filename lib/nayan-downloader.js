let resolved = {}

try {
  const mod = await import("nayan-videos-downloader")
  resolved = mod?.default || mod || {}
} catch {
  resolved = {}
}

const createUnavailable = method => async () => {
  throw new Error(`Downloader service unavailable for ${method}`)
}

export default new Proxy(resolved, {
  get(target, prop) {
    if (typeof prop !== "string") return target[prop]
    if (prop in target && typeof target[prop] === "function") return target[prop]
    return createUnavailable(prop)
  },
})
