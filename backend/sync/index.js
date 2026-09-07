const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { PrismaClient } = require('@prisma/client')
const { normalizeItem } = require('./normalize')
const mockProvider = require('./providers/mockProvider')
const jsonUrlProvider = require('./providers/jsonUrlProvider')
const rakutenProvider = require('./providers/rakutenProvider')
const rakutenListedProvider = require('./providers/rakutenListedProvider')

const prisma = new PrismaClient()

const providers = new Map([
  [mockProvider.name, mockProvider],
  [jsonUrlProvider.name, jsonUrlProvider],
  [rakutenProvider.name, rakutenProvider],
  [rakutenListedProvider.name, rakutenListedProvider],
])

async function upsertNormalizedItem(item) {
  const category = await prisma.category.upsert({
    where: { name: item.category },
    update: {},
    create: { name: item.category },
  })

  const product = await prisma.product.upsert({
    where: { sourceId: item.sourceId },
    update: {
      categoryId: category.id,
      brand: item.brand,
      name: item.name,
      flavor: item.flavor,
      weightG: item.weightG,
      servings: item.servings,
      servingSizeG: item.servingSizeG,
      proteinPerServing: item.proteinPerServing,
      sweetener: item.sweetener,
    },
    create: {
      sourceId: item.sourceId,
      categoryId: category.id,
      brand: item.brand,
      name: item.name,
      flavor: item.flavor,
      weightG: item.weightG,
      servings: item.servings,
      servingSizeG: item.servingSizeG,
      proteinPerServing: item.proteinPerServing,
      sweetener: item.sweetener,
    },
  })

  const totalPriceYen = item.offer.priceYen + item.offer.shippingYen

  const productPrice = await prisma.productPrice.upsert({
    where: { productId: product.id },
    update: {
      sourceName: item.offer.shopName,
      sourceUrl: item.offer.productUrl,
      priceYen: item.offer.priceYen,
      shippingYen: item.offer.shippingYen,
      totalPriceYen,
      inStock: item.offer.inStock,
      fetchedAt: item.offer.fetchedAt,
    },
    create: {
      productId: product.id,
      sourceName: item.offer.shopName,
      sourceUrl: item.offer.productUrl,
      priceYen: item.offer.priceYen,
      shippingYen: item.offer.shippingYen,
      totalPriceYen,
      inStock: item.offer.inStock,
      fetchedAt: item.offer.fetchedAt,
    },
  })

  await prisma.priceHistory.create({
    data: {
      productPriceId: productPrice.id,
      priceYen: item.offer.priceYen,
      shippingYen: item.offer.shippingYen,
      totalPriceYen,
      fetchedAt: item.offer.fetchedAt,
    },
  })
}

async function syncProducts({ provider = 'mock', options = {} } = {}) {
  const targetProvider = providers.get(provider)

  if (!targetProvider) {
    throw new Error(`Unknown provider: ${provider}`)
  }

  const rawItems = await targetProvider.fetchItems(options)

  if (!Array.isArray(rawItems)) {
    throw new Error('Provider must return an array of items')
  }

  const normalizedItems = rawItems.map((item) => normalizeItem(item))

  for (const item of normalizedItems) {
    await upsertNormalizedItem(item)
  }

  return {
    provider,
    count: normalizedItems.length,
    syncedAt: new Date().toISOString(),
  }
}

async function disconnect() {
  await prisma.$disconnect()
}

module.exports = {
  syncProducts,
  disconnect,
  providers: [...providers.keys()],
}
