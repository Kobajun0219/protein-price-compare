const RAKUTEN_PRODUCT_SEARCH_ENDPOINT =
  'https://openapi.rakuten.co.jp/ichibaproduct/api/Product/Search/20250801'
const { parseRakutenItemCodeFromUrl } = require('../rakutenItemCode')

const DEFAULT_KEYWORD = 'プロテイン'
const DEFAULT_ORIGIN = 'https://protein-price-compare.com/'

function toInt(value, fallback) {
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

function detectCategory(name) {
  const text = String(name)

  if (/スキム|脱脂粉乳/i.test(text)) {
    return 'スキムミルクプロテイン'
  }

  if (/ソイ|大豆/i.test(text)) {
    return 'ソイプロテイン'
  }

  if (/ミルクプロテイン|inPROTEIN/i.test(text)) {
    return 'ミルクプロテイン'
  }

  return 'ホエイプロテイン'
}

function estimateServingSize(category) {
  if (category === 'ミルクプロテイン') {
    return 200
  }

  if (category === 'スキムミルクプロテイン') {
    return 20
  }

  return 30
}

function estimateProteinPerServing(category) {
  if (category === 'ソイプロテイン') {
    return 20
  }

  if (category === 'ミルクプロテイン') {
    return 15
  }

  if (category === 'スキムミルクプロテイン') {
    return 8
  }

  return 21
}

function extractWeightG(name) {
  const text = String(name)
  const candidates = []

  const kgMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*kg/gi)]
  for (const match of kgMatches) {
    candidates.push(Math.round(Number(match[1]) * 1000))
  }

  const gMatches = [...text.matchAll(/(\d{2,5})\s*g/gi)]
  for (const match of gMatches) {
    candidates.push(Math.round(Number(match[1])))
  }

  if (candidates.length === 0) {
    return 1000
  }

  return Math.max(...candidates)
}

function pickPrice(product) {
  const candidates = [
    product.salesMinPrice,
    product.minPrice,
    product.averagePrice,
    product.usedExcludeSalesMinPrice,
    product.usedExcludeMinPrice,
  ]

  for (const price of candidates) {
    const parsed = toInt(price, -1)
    if (parsed >= 0) {
      return parsed
    }
  }

  return 0
}

function mapRakutenProduct(raw) {
  const product = raw.product || raw.Product || raw.item || raw.Item || raw
  const name = toStringValue(product.productName || product.itemName, 'Unknown')
  const category = detectCategory(name)
  const weightG = extractWeightG(name)
  const servingSizeG = estimateServingSize(category)
  const servings = Math.max(1, Math.round(weightG / servingSizeG))
  const proteinPerServing = estimateProteinPerServing(category)
  const brand =
    toStringValue(product.brandName) ||
    toStringValue(product.makerName) ||
    toStringValue(product.shopName) ||
    'Rakuten Product'
  const productUrl =
    toStringValue(product.productUrlPC) ||
    toStringValue(product.productUrl) ||
    toStringValue(product.affiliateUrl) ||
    toStringValue(product.searchUrl) ||
    null
  const itemCode =
    toStringValue(product.itemCode) || parseRakutenItemCodeFromUrl(productUrl) || ''
  const sourceId =
    itemCode ||
    toStringValue(product.productId) ||
    toStringValue(product.productCode) ||
    name
  const rawFlavor = toStringValue(product.productNo)

  return {
    id: sourceId,
    itemCode: itemCode || null,
    category,
    brand,
    name,
    flavor: rawFlavor || '不明',
    weightG,
    servings,
    servingSizeG,
    proteinPerServing,
    sweetener: '不明',
    shopName: 'Rakuten Product Search',
    productUrl,
    priceYen: pickPrice(product),
    shippingYen: 0,
    inStock: true,
    fetchedAt: new Date().toISOString(),
  }
}

function extractProducts(payload) {
  const candidates = [
    payload?.products,
    payload?.Products,
    payload?.items,
    payload?.Items,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return []
}

async function fetchOnePage({ endpoint, query, headers }) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(query).toString()}`, {
    headers,
  })

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

  if (payload.error) {
    throw new Error(`Rakuten API error: ${payload.error}`)
  }

  if (payload.errors?.errorMessage) {
    throw new Error(`Rakuten API error: ${payload.errors.errorMessage}`)
  }

  return payload
}

async function fetchItems(options = {}) {
  const applicationId = toStringValue(
    options.appId || process.env.RAKUTEN_APP_ID || process.env.RAKUTEN_APPLICATION_ID,
  )
  const accessKey = toStringValue(options.accessKey || process.env.RAKUTEN_ACCESS_KEY)
  const endpoint = toStringValue(
    options.endpoint || process.env.RAKUTEN_API_ENDPOINT,
    RAKUTEN_PRODUCT_SEARCH_ENDPOINT,
  )
  const origin = toStringValue(options.origin || process.env.RAKUTEN_ORIGIN, DEFAULT_ORIGIN)

  if (!applicationId) {
    throw new Error('rakuten provider requires RAKUTEN_APP_ID or --appId')
  }

  if (!accessKey) {
    throw new Error('rakuten provider requires RAKUTEN_ACCESS_KEY or --accessKey')
  }

  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID
  const keyword = toStringValue(options.keyword || process.env.RAKUTEN_KEYWORD, DEFAULT_KEYWORD)
  const genreId = toStringValue(options.genreId || process.env.RAKUTEN_GENRE_ID)
  const formatVersion = toInt(options.formatVersion || process.env.RAKUTEN_FORMAT_VERSION, 2)
  const hits = Math.min(30, Math.max(1, toInt(options.hits, 20)))
  const pages = Math.min(5, Math.max(1, toInt(options.pages, 1)))
  const headers = {
    accessKey,
    Origin: origin,
    Referer: origin,
  }

  const collected = []

  for (let page = 1; page <= pages; page += 1) {
    const params = {
      format: 'json',
      applicationId,
      accessKey,
      keyword,
      formatVersion: String(formatVersion),
      hits: String(hits),
      page: String(page),
      sort: 'standard',
    }

    if (genreId) {
      params.genreId = genreId
    }

    if (affiliateId) {
      params.affiliateId = affiliateId
    }

    const payload = await fetchOnePage({
      endpoint,
      query: params,
      headers,
    })
    const products = extractProducts(payload)

    for (const raw of products) {
      collected.push(mapRakutenProduct(raw))
    }

    if (products.length < hits) {
      break
    }
  }

  return collected
}

module.exports = {
  name: 'rakuten',
  fetchItems,
}
