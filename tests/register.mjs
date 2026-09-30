// Registers a resolve hook so tests can `import(...)` app source files
// (like the API route handler) directly with Node, the same way Next.js's
// bundler would resolve them:
//   1. the "@/*" tsconfig path alias -> project root
//   2. extensionless local specifiers -> the actual .ts/.tsx/.mjs/.js file
//
// Only used by `npm test` (see package.json). Next.js itself never goes
// through this file â€” its own bundler already understands both of these.
import { register } from "node:module"

register("./resolve-hooks.mjs", import.meta.url)
