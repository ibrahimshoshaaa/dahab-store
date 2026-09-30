import { existsSync, statSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"

const PROJECT_ROOT = new URL("../", import.meta.url)
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"]

function withResolvedExtension(fileUrl) {
  const path = fileURLToPath(fileUrl)
  const asHref = typeof fileUrl === "string" ? fileUrl : fileUrl.href
  if (existsSync(path) && statSync(path).isFile()) return asHref
  for (const ext of EXTENSIONS) {
    if (existsSync(path + ext)) return pathToFileURL(path + ext).href
  }
  for (const ext of EXTENSIONS) {
    const indexPath = `${path}/index${ext}`
    if (existsSync(indexPath)) return pathToFileURL(indexPath).href
  }
  return asHref
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = withResolvedExtension(new URL(specifier.slice(2), PROJECT_ROOT))
    return nextResolve(target, context)
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const target = withResolvedExtension(new URL(specifier, context.parentURL))
    if (target !== new URL(specifier, context.parentURL).href) {
      return nextResolve(target, context)
    }
  }

  return nextResolve(specifier, context)
}
