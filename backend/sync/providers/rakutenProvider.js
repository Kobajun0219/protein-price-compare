const RAKUTEN_ITEM_SEARCH_ENDPOINT =
  'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601'

const DEFAULT_KEYWORD = 'プロテイン'

function toInt(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num) : fallback
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

function mapRakutenItem(raw) {
  const item = raw.Item || raw
  const name = item.itemName || 'Unknown'
  const category = detectCategory(name)
  const weightG = extractWeightG(name)
  const servingSizeG = estimateServingSize(category)
  const servings = Math.max(1, Math.round(weightG / servingSizeG))
  const proteinPerServing = estimateProteinPerServing(category)

  return {
    id: item.itemCode,
    category,
    brand: item.shopName || 'Rakuten Shop',
    name,
    flavor: '不明',
    weightG,
    servings,
    servingSizeG,
    proteinPerServing,
    sweetener: '不明',
    shopName: item.shopName || 'Rakuten Shop',
    productUrl: item.itemUrl || null,
    priceYen: toInt(item.itemPrice, 0),
    shippingYen: 0,
    inStock: true,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchOnePage(params) {
  const query = new URLSearchParams(params)
  const response = await fetch(`${RAKUTEN_ITEM_SEARCH_ENDPOINT}?${query.toString()}`)

  if (!response.ok) {
    throw new Error(`Rakuten API error: ${response.status}`)
  }

  const payload = await response.json()

  if (payload.error) {
    throw new Error(`Rakuten API error: ${payload.error}`)
  }

  return payload
}

async function fetchItems(options = {}) {
  const applicationId =
    options.appId || process.env.RAKUTEN_APP_ID || process.env.RAKUTEN_APPLICATION_ID

  if (!applicationId) {
    throw new Error('rakuten provider requires RAKUTEN_APP_ID or --appId')
  }

  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID
  const keyword = options.keyword || process.env.RAKUTEN_KEYWORD || DEFAULT_KEYWORD
  const hits = Math.min(30, Math.max(1, toInt(options.hits, 20)))
  const pages = Math.min(5, Math.max(1, toInt(options.pages, 1)))

  const collected = []

  for (let page = 1; page <= pages; page += 1) {
    const params = {
      format: 'json',
      applicationId,
      keyword,
      hits: String(hits),
      page: String(page),
      sort: '+itemPrice',
      availability: '1',
      imageFlag: '1',
    }

    if (affiliateId) {
      params.affiliateId = affiliateId
    }

    const payload = await fetchOnePage(params)
    const items = Array.isArray(payload.Items) ? payload.Items : []

    for (const raw of items) {
      collected.push(mapRakutenItem(raw))
    }

    if (items.length < hits) {
      break
    }
  }

  return collected
}

module.exports = {
  name: 'rakuten',
  fetchItems,
}
