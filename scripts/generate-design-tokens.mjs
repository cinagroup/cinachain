import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tokensPath = resolve(root, "design/tokens.json")
const targets = [
  resolve(root, "styles/generated/design-tokens.css"),
  resolve(root, "portal/design-tokens.css"),
  resolve(root, "docs-site/src/css/design-tokens.css"),
]

const tokens = JSON.parse(await readFile(tokensPath, "utf8"))
const isCheck = process.argv.includes("--check")

const kebab = (value) =>
  value
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/([a-z])([0-9])/g, "$1-$2")

const declarations = (prefix, values) =>
  Object.entries(values)
    .map(([key, value]) => `  --${prefix}-${kebab(key)}: ${value};`)
    .join("\n")

const semanticDeclarations = (values, excludedKeys = []) =>
  Object.entries(values)
    .filter(([key]) => !excludedKeys.includes(key))
    .map(([key, value]) => {
      const aliases = {
        body: "color-body",
        selectionBackground: "selection-bg",
        selectionForeground: "selection-fg",
      }
      return `  --${aliases[key] ?? kebab(key)}: ${value};`
    })
    .join("\n")

const typographyDeclarations = Object.entries(tokens.typography)
  .flatMap(([name, values]) =>
    Object.entries(values).map(
      ([key, value]) => `  --type-${kebab(name)}-${kebab(key)}: ${value};`
    )
  )
  .join("\n")

const css = `/* Generated from design/tokens.json. Do not edit directly. */
:root {
  color-scheme: light;
${declarations("color", tokens.color)}
${semanticDeclarations(tokens.semantic.light, ["body"])}
${declarations("spacing", tokens.spacing)}
${declarations("radius", tokens.radius)}
${declarations("shadow", tokens.shadow)}
${declarations("breakpoint", tokens.breakpoint)}
${declarations("layout", tokens.layout)}
${typographyDeclarations}
  --color-success: var(--color-link);
}

.dark,
[data-theme="dark"] {
  color-scheme: dark;
${semanticDeclarations(tokens.semantic.dark)}
}
`

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
const rootVariableNames = [...rootBlock.matchAll(/^\s*(--[\w-]+):/gm)].map(
  (match) => match[1]
)
const duplicateRootVariables = rootVariableNames.filter(
  (name, index) => rootVariableNames.indexOf(name) !== index
)

if (duplicateRootVariables.length > 0) {
  throw new Error(
    `Duplicate :root token declarations: ${[
      ...new Set(duplicateRootVariables),
    ].join(", ")}`
  )
}

const generatedVariables = new Set([
  ...css.matchAll(/^\s*(--[\w-]+):/gm),
].map((match) => match[1]))
const shadowConsumers = [
  resolve(root, "styles/globals.css"),
  resolve(root, "tailwind.config.js"),
  resolve(root, "portal/index.html"),
]

for (const consumer of shadowConsumers) {
  const source = await readFile(consumer, "utf8")
  const references = [...source.matchAll(/var\((--shadow-[\w-]+)\)/g)].map(
    (match) => match[1]
  )
  const missing = references.filter((name) => !generatedVariables.has(name))
  if (missing.length > 0) {
    throw new Error(
      `Unknown generated shadow token in ${consumer}: ${[
        ...new Set(missing),
      ].join(", ")}`
    )
  }
}

const staleTargets = []

for (const target of targets) {
  let current = ""
  try {
    current = await readFile(target, "utf8")
  } catch {
    // A missing generated file is stale by definition.
  }

  if (current === css) continue

  if (isCheck) {
    staleTargets.push(target)
    continue
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, css, "utf8")
}

if (staleTargets.length > 0) {
  console.error("Generated design tokens are stale:")
  staleTargets.forEach((target) => console.error(`- ${target}`))
  process.exitCode = 1
} else if (isCheck) {
  console.log("Generated design tokens are current.")
} else {
  console.log(`Generated design tokens for ${targets.length} surfaces.`)
}
