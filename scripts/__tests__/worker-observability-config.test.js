import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const workersRoot = join(repositoryRoot, "workers")

describe("Worker observability configuration", () => {
  it("keeps persisted logs enabled with a bounded sampling rate", async () => {
    const entries = await readdir(workersRoot, { withFileTypes: true })
    const workerConfigs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(workersRoot, entry.name, "wrangler.toml"))

    expect(workerConfigs.length).toBeGreaterThan(0)

    for (const configPath of workerConfigs) {
      const config = await readFile(configPath, "utf8")
      const observability = config.match(
        /\[observability\]([\s\S]*?)(?=\n\s*\[|$)/
      )?.[1]

      expect(observability, configPath).toBeDefined()
      expect(observability, configPath).toMatch(/^\s*enabled\s*=\s*true\s*$/m)

      const samplingRate = Number(
        observability?.match(/^\s*head_sampling_rate\s*=\s*([\d.]+)\s*$/m)?.[1]
      )
      expect(samplingRate, configPath).toBeGreaterThan(0)
      expect(samplingRate, configPath).toBeLessThanOrEqual(0.1)
    }
  })
})
