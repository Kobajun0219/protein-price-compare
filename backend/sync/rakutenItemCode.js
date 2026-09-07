function parseRakutenItemCodeFromUrl(sourceUrl) {
  if (!sourceUrl) {
    return null
  }

  let parsed
  try {
    parsed = new URL(String(sourceUrl))
  } catch {
    return null
  }

  if (!/item\.rakuten\.co\.jp$/i.test(parsed.hostname)) {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const shopCode = segments[0]
  const itemId = segments[1]

  if (!shopCode || !itemId) {
    return null
  }

  return `${shopCode}:${itemId}`
}

module.exports = {
  parseRakutenItemCodeFromUrl,
}
