const { PrismaClient } = require('@prisma/client')
const proteins = require('../data/proteins')

const prisma = new PrismaClient()

async function main() {
  await prisma.priceHistory.deleteMany()
  await prisma.offer.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()

  const categoryByName = new Map()

  for (const item of proteins) {
    const categoryName = item.category || 'ホエイプロテイン'

    let category = categoryByName.get(categoryName)
    if (!category) {
      category = await prisma.category.create({
        data: { name: categoryName },
      })
      categoryByName.set(categoryName, category)
    }

    const product = await prisma.product.create({
      data: {
        sourceId: item.id,
        categoryId: category.id,
        brand: item.brand,
        name: item.name,
        flavor: item.flavor,
        weightG: item.weightG,
        servings: item.servings,
        servingSizeG: item.servingSizeG,
        proteinPerServing: item.proteinPerServing,
        sweetener: item.sweetener,
        tagsCsv: (item.tags || []).join(','),
      },
    })

    const offer = await prisma.offer.create({
      data: {
        productId: product.id,
        shopName: 'MockStore',
        priceYen: item.priceYen,
        shippingYen: 0,
        totalPriceYen: item.priceYen,
        inStock: true,
        fetchedAt: new Date(),
      },
    })

    await prisma.priceHistory.create({
      data: {
        offerId: offer.id,
        priceYen: item.priceYen,
        shippingYen: 0,
        totalPriceYen: item.priceYen,
        fetchedAt: new Date(),
      },
    })
  }

  console.log(`Seeded ${proteins.length} products into SQLite.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
