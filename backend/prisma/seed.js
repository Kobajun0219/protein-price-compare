const { PrismaClient } = require('@prisma/client')
const proteins = require('../data/proteins')
const { parseRakutenItemCodeFromUrl } = require('../sync/rakutenItemCode')

const prisma = new PrismaClient()

async function main() {
  await prisma.priceHistory.deleteMany()
  await prisma.productPrice.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()

  const categoryByName = new Map()

  for (const item of proteins) {
    const categoryName = item.category || 'ホエイプロテイン'
    const sourceId = item.itemCode || item.id || parseRakutenItemCodeFromUrl(item.sourceUrl)

    let category = categoryByName.get(categoryName)
    if (!category) {
      category = await prisma.category.create({
        data: { name: categoryName },
      })
      categoryByName.set(categoryName, category)
    }

    const product = await prisma.product.create({
      data: {
        sourceId,
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

    const productPrice = await prisma.productPrice.create({
      data: {
        productId: product.id,
        sourceName: item.sourceName || 'MockStore',
        sourceUrl: item.sourceUrl || null,
        priceYen: item.priceYen,
        shippingYen: 0,
        totalPriceYen: item.priceYen,
        inStock: true,
        fetchedAt: new Date(),
      },
    })

    await prisma.priceHistory.create({
      data: {
        productPriceId: productPrice.id,
        priceYen: item.priceYen,
        shippingYen: 0,
        totalPriceYen: item.priceYen,
        fetchedAt: new Date(),
      },
    })
  }

  console.log(`Seeded ${proteins.length} products into PostgreSQL.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
