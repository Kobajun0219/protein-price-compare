const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { syncProducts, disconnect } = require('../sync')

const args = process.argv.slice(2)

function parseArgs(argv) {
  const parsed = {
    provider: 'mock',
    options: {},
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const next = argv[i + 1]

    if (token === '--provider') {
      parsed.provider = next
      i += 1
      continue
    }

    if (token.startsWith('--')) {
      const key = token.slice(2)
      parsed.options[key] = next
      i += 1
    }
  }

  return parsed
}

async function main() {
  const options = parseArgs(args)

  try {
    const result = await syncProducts({
      provider: options.provider,
      options: options.options,
    })

    console.log(
      `[sync] provider=${result.provider} count=${result.count} syncedAt=${result.syncedAt}`,
    )
  } catch (error) {
    console.error('[sync] failed:', error.message)
    process.exitCode = 1
  } finally {
    await disconnect()
  }
}

main()
