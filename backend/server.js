const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { syncProducts, providers } = require('./sync')

const app = express()
const PORT = process.env.PORT || 4000
const prisma = new PrismaClient()

const ALLOWED_SORT_KEYS = new Set([
  'category',
  'name',
  'weightG',
  'priceYen',
  'servingSizeG',
  'proteinPerServing',
  'powderPricePerGram',
  'proteinPricePerGram',
  'pricePerServing',
  'sweetener',
])

const normalizeSortDirection = (order) =>
  String(order).toLowerCase() === 'desc' ? 'desc' : 'asc'

const compareValues = (left, right, direction, isString = false) => {
  const base = isString
    ? String(left).localeCompare(String(right), 'ja')
    : Number(left) - Number(right)

  return direction === 'asc' ? base : -base
}

const buildProductResponse = (product) => {
  const offer = product.offers[0]
  const priceYen = offer ? offer.totalPriceYen : 0
  const pricePerServing = product.servings > 0 ? priceYen / product.servings : 0
  const powderPricePerGram = product.weightG > 0 ? priceYen / product.weightG : 0
  const totalProtein = product.proteinPerServing * product.servings
  const proteinPricePerGram = totalProtein > 0 ? priceYen / totalProtein : 0

  return {
    id: product.sourceId,
    category: product.category.name,
    brand: product.brand,
    name: product.name,
    flavor: product.flavor,
    weightG: product.weightG,
    priceYen,
    servings: product.servings,
    servingSizeG: product.servingSizeG,
    proteinPerServing: product.proteinPerServing,
    sweetener: product.sweetener,
    tags: product.tagsCsv ? product.tagsCsv.split(',') : [],
    pricePerServing,
    powderPricePerGram,
    proteinPricePerGram,
    proteinRate:
      product.servingSizeG > 0
        ? (product.proteinPerServing / product.servingSizeG) * 100
        : 0,
  }
}

const sortItems = (items, sort, direction) => {
  const sorted = [...items]

  sorted.sort((a, b) => {
    if (sort === 'category' || sort === 'name' || sort === 'sweetener') {
      return compareValues(a[sort], b[sort], direction, true)
    }

    return compareValues(a[sort], b[sort], direction, false)
  })

  return sorted
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'API is running' })
})

app.get('/api/sync/providers', (_req, res) => {
  res.json({ providers })
})

app.post('/api/sync', async (req, res) => {
  try {
    const body = req.body || {}
    const provider = body.provider || 'mock'
    const { provider: _provider, ...options } = body
    const result = await syncProducts({
      provider,
      options,
    })

    return res.json({ ok: true, ...result })
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message })
  }
})

app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category
    const sort = req.query.sort || 'proteinPricePerGram'
    const direction = normalizeSortDirection(req.query.order)

    if (!ALLOWED_SORT_KEYS.has(sort)) {
      return res.status(400).json({
        message: 'Invalid sort parameter',
        allowed: [...ALLOWED_SORT_KEYS],
      })
    }

    const whereClause =
      category && category !== '全カテゴリ'
        ? {
            category: {
              name: String(category),
            },
          }
        : undefined

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        offers: {
          orderBy: {
            fetchedAt: 'desc',
          },
          take: 1,
        },
      },
    })

    const items = products.map(buildProductResponse)
    const sortedItems = sortItems(items, sort, direction)

    return res.json({
      generatedAt: new Date().toISOString(),
      count: sortedItems.length,
      items: sortedItems,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Failed to fetch products' })
  }
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

app.listen(PORT, () => {
  console.log(`Protein API listening on http://localhost:${PORT}`)
})
