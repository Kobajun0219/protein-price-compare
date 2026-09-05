const toInt = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num) : fallback
}

const toFloat = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const toStringValue = (value, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback
  }

  return String(value).trim() || fallback
}

const normalizeItem = (item, defaults = {}) => {
  const sourceId = toStringValue(item.id || item.sourceId)

  if (!sourceId) {
    throw new Error('sourceId is required')
  }

  return {
    sourceId,
    category: toStringValue(item.category, defaults.category || 'ホエイプロテイン'),
    brand: toStringValue(item.brand, defaults.brand || 'Unknown'),
    name: toStringValue(item.name, defaults.name || sourceId),
    flavor: toStringValue(item.flavor, defaults.flavor || 'プレーン'),
    weightG: toInt(item.weightG, defaults.weightG || 0),
    servings: toInt(item.servings, defaults.servings || 1),
    servingSizeG: toInt(item.servingSizeG, defaults.servingSizeG || 0),
    proteinPerServing: toFloat(item.proteinPerServing, defaults.proteinPerServing || 0),
    sweetener: toStringValue(item.sweetener, defaults.sweetener || '不明'),
    offer: {
      shopName: toStringValue(item.shopName, defaults.shopName || 'MockStore'),
      productUrl: item.productUrl ? String(item.productUrl) : null,
      priceYen: toInt(item.priceYen, defaults.priceYen || 0),
      shippingYen: toInt(item.shippingYen, defaults.shippingYen || 0),
      inStock: item.inStock === undefined ? true : Boolean(item.inStock),
      fetchedAt: item.fetchedAt ? new Date(item.fetchedAt) : new Date(),
    },
  }
}

module.exports = {
  normalizeItem,
}
