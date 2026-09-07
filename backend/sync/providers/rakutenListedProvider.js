const proteins = require('../../data/proteins')
const { parseRakutenItemCodeFromUrl } = require('../rakutenItemCode')

const RAKUTEN_ITEM_SEARCH_ENDPOINT =
  'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701'
const DEFAULT_ORIGIN = 'https://protein-price-compare.com/'
const DEFAULT_DELAY_MS = 600
const DEFAULT_MAX_ATTEMPTS = 4

function toInt(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num) : fallback
}

function toStringValue(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }

  const text = String(value).trim()
  return text || fallback
}

function unwrapItems(payload) {
  const items = payload?.items || payload?.Items || []
  return items.map((entry) => entry.item || entry.Item || entry)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseShopCodeFromUrl(sourceUrl) {
  try {
    const parsed = new URL(String(sourceUrl))
    const segments = parsed.pathname.split('/').filter(Boolean)
    return segments[0] || null
  } catch {
    return null
  }
}

function extractNumericItemId(html) {
  const patterns = [
    /item_id=(\d+)/i,
    /["']item_id["']\s*[:=]\s*["']?(\d+)/i,
    /["']itemId["']\s*[:=]\s*["']?(\d+)/i,
    /&iid=(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function extractDisplayedPrice(html) {
  const embeddedPatterns = [
    /&quot;price&quot;\s*:\s*(\d+)/i,
    /"price"\s*:\s*(\d+)/i,
  ]

  for (const pattern of embeddedPatterns) {
    const match = String(html).match(pattern)
    if (match?.[1]) {
      const price = toInt(match[1], -1)
      if (price >= 0) {
        return price
      }
    }
  }

  const text = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')

  const patterns = [
    /商品番号：.*?通常購入\s*([\d,]+)(?:\s*[〜~]\s*([\d,]+))?\s*円/si,
    /通常購入\s*([\d,]+)(?:\s*[〜~]\s*([\d,]+))?\s*円/si,
    /([\d,]+)(?:\s*[〜~]\s*([\d,]+))?\s*円送料無料/si,
    /価格\s*([\d,]+)(?:\s*[〜~]\s*([\d,]+))?\s*円/si,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) {
      continue
    }

    const first = toInt(match[1].replace(/,/g, ''), -1)
    const second = match[2] ? toInt(match[2].replace(/,/g, ''), -1) : -1

    if (first >= 0 && second >= 0) {
      return Math.min(first, second)
    }

    if (first >= 0) {
      return first
    }
  }

  return null
}

async function fetchSourcePageHtml(sourceUrl) {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`failed to fetch source page: ${response.status}`)
  }

  return response.text()
}

function resolveItemCodeFromSourcePage(sourceUrl, html) {
  const shopCode = parseShopCodeFromUrl(sourceUrl)
  if (!shopCode) {
    return null
  }

  const numericItemId = extractNumericItemId(html)
  if (!numericItemId) {
    throw new Error('item_id could not be extracted from source page')
  }

  return `${shopCode}:${numericItemId}`
}

async function fetchItemByCode({ applicationId, accessKey, affiliateId, itemCode, origin }) {
  const params = {
    applicationId,
    accessKey,
    format: 'json',
    formatVersion: '2',
    itemCode,
    availability: '1',
    elements: 'itemName,itemCode,itemPrice,itemUrl,availability,shopName,shopCode',
  }

  if (affiliateId) {
    params.affiliateId = affiliateId
  }

  const response = await fetch(
    `${RAKUTEN_ITEM_SEARCH_ENDPOINT}?${new URLSearchParams(params).toString()}`,
    {
      headers: {
        accessKey,
        Origin: origin,
        Referer: origin,
      },
    },
  )

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload?.error_description || payload?.error || payload?.errors?.errorMessage
    throw new Error(
      detail
        ? `Rakuten API error: ${response.status} (${detail})`
        : `Rakuten API error: ${response.status}`,
    )
  }

  if (!payload) {
    throw new Error('Rakuten API error: empty response body')
  }

  if (payload.error || payload.errors?.errorMessage) {
    throw new Error(payload.error_description || payload.error || payload.errors.errorMessage)
  }

  const items = unwrapItems(payload)
  return items[0] || null
}

async function fetchItems(options = {}) {
  const applicationId = toStringValue(
    options.appId || process.env.RAKUTEN_APP_ID || process.env.RAKUTEN_APPLICATION_ID,
  )
  const accessKey = toStringValue(options.accessKey || process.env.RAKUTEN_ACCESS_KEY)
  const affiliateId = toStringValue(options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID)
  const origin = toStringValue(options.origin || process.env.RAKUTEN_ORIGIN, DEFAULT_ORIGIN)
  const limit = Math.max(0, toInt(options.limit, proteins.length))
  const delayMs = Math.max(0, toInt(options.delayMs || process.env.RAKUTEN_DELAY_MS, DEFAULT_DELAY_MS))
  const maxAttempts = Math.max(
    1,
    toInt(options.maxAttempts || process.env.RAKUTEN_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
  )
  const targets = limit > 0 ? proteins.slice(0, limit) : proteins

  if (!applicationId) {
    throw new Error('rakutenListed provider requires RAKUTEN_APP_ID or --appId')
  }

  if (!accessKey) {
    throw new Error('rakutenListed provider requires RAKUTEN_ACCESS_KEY or --accessKey')
  }

  const collected = []
  const failures = []

  for (const product of targets) {
    let itemCode = parseRakutenItemCodeFromUrl(product.sourceUrl)

    if (!itemCode) {
      failures.push(`${product.name}: itemCode could not be derived from sourceUrl`)
      continue
    }

    try {
      const sourcePageHtml = await fetchSourcePageHtml(product.sourceUrl)
      itemCode = resolveItemCodeFromSourcePage(product.sourceUrl, sourcePageHtml)
      let item = null

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          item = await fetchItemByCode({
            applicationId,
            accessKey,
            affiliateId,
            itemCode,
            origin,
          })
          break
        } catch (error) {
          const isRateLimited = /429/.test(error.message)
          const canRetry = isRateLimited && attempt < maxAttempts

          if (!canRetry) {
            throw error
          }

          await delay(delayMs * attempt)
        }
      }

      if (!item) {
        const fallbackPrice = extractDisplayedPrice(sourcePageHtml)
        if (fallbackPrice === null) {
          failures.push(`${product.name}: item not found for ${itemCode}`)
          continue
        }

        collected.push({
          sourceId: product.id,
          itemCode,
          category: product.category,
          brand: product.brand,
          name: product.name,
          flavor: product.flavor,
          weightG: product.weightG,
          servings: product.servings,
          servingSizeG: product.servingSizeG,
          proteinPerServing: product.proteinPerServing,
          sweetener: product.sweetener,
          shopName: product.sourceName || 'Rakuten商品ページ',
          productUrl: product.sourceUrl,
          priceYen: fallbackPrice,
          shippingYen: 0,
          inStock: true,
          fetchedAt: new Date().toISOString(),
        })

        if (delayMs > 0) {
          await delay(delayMs)
        }

        continue
      }

      collected.push({
        sourceId: product.id,
        itemCode,
        category: product.category,
        brand: product.brand,
        name: product.name,
        flavor: product.flavor,
        weightG: product.weightG,
        servings: product.servings,
        servingSizeG: product.servingSizeG,
        proteinPerServing: product.proteinPerServing,
        sweetener: product.sweetener,
        shopName: toStringValue(item.shopName, product.sourceName || 'Rakuten商品ページ'),
        productUrl: toStringValue(item.itemUrl, product.sourceUrl),
        priceYen: toInt(item.itemPrice, product.priceYen),
        shippingYen: 0,
        inStock: toInt(item.availability, 1) === 1,
        fetchedAt: new Date().toISOString(),
      })

      if (delayMs > 0) {
        await delay(delayMs)
      }
    } catch (error) {
      failures.push(`${product.name}: ${error.message}`)
    }
  }

  if (collected.length === 0) {
    throw new Error(`rakutenListed provider failed: ${failures.join(' | ')}`)
  }

  if (failures.length > 0) {
    console.warn(`[rakutenListed] skipped ${failures.length} items`)
    for (const failure of failures) {
      console.warn(`[rakutenListed] ${failure}`)
    }
  }

  return collected
}

module.exports = {
  name: 'rakutenListed',
  fetchItems,
}
