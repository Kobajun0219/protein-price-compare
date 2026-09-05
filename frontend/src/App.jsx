import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const ALL_CATEGORIES = '全カテゴリ'
const CATEGORY_ORDER = [
  'ホエイプロテイン',
  'ソイプロテイン',
  'ミルクプロテイン',
  'スキムミルクプロテイン',
]

const CATEGORY_DESCRIPTIONS = {
  ホエイプロテイン:
    '牛乳由来で吸収が速く、トレーニング後のリカバリー向け。味の種類が多く、継続しやすい定番タイプです。',
  ソイプロテイン:
    '大豆由来で腹持ちが良く、ゆるやかに吸収されます。置き換えや体づくりを長時間サポートしたい人向けです。',
  ミルクプロテイン:
    'ホエイとカゼインを含むバランス型で、速さと持続の中間。日常的なたんぱく質補給に使いやすいタイプです。',
  スキムミルクプロテイン:
    '脱脂粉乳ベースで脂質が少なく、ミルク感のある風味が特徴。飲用だけでなく料理にも使いやすいタイプです。',
  全カテゴリ:
    '全カテゴリの商品をまとめて比較します。カテゴリ横断で価格や成分を見たいときに使ってください。',
}

const SORTABLE_COLUMNS = [
  { key: 'category', label: 'カテゴリ', type: 'string' },
  { key: 'name', label: '商品', type: 'string' },
  { key: 'weightG', label: '容量', type: 'number' },
  { key: 'priceYen', label: '価格', type: 'number' },
  { key: 'servingSizeG', label: '1回量', type: 'number' },
  { key: 'proteinPerServing', label: 'たんぱく質', type: 'number' },
  { key: 'powderPricePerGram', label: '粉末1g単価', type: 'number' },
  { key: 'proteinPricePerGram', label: 'たんぱく質1g単価', type: 'number' },
  { key: 'pricePerServing', label: '1回あたり価格', type: 'number' },
  { key: 'sweetener', label: '甘味料', type: 'string' },
  { key: 'sourceName', label: '出典', type: 'string' },
]

const formatYen = (value) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value)

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES)
  const [sortConfig, setSortConfig] = useState({
    key: 'proteinPricePerGram',
    direction: 'asc',
  })

  useEffect(() => {
    const controller = new AbortController()

    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/products`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('商品データの取得に失敗しました')
        }

        const data = await response.json()
        setProducts(data.items ?? [])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('API接続エラー: バックエンドが起動しているか確認してください。')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()

    return () => controller.abort()
  }, [])

  const enhancedProducts = useMemo(
    () =>
      products.map((item) => {
        const category = item.category || 'ホエイプロテイン'
        const pricePerServing = item.priceYen / item.servings
        const powderPricePerGram = item.priceYen / item.weightG
        const proteinPricePerGram =
          item.priceYen / (item.proteinPerServing * item.servings)
        const proteinRate = (item.proteinPerServing / item.servingSizeG) * 100

        return {
          ...item,
          category,
          pricePerServing,
          powderPricePerGram,
          proteinPricePerGram,
          proteinRate,
        }
      }),
    [products],
  )

  const categories = useMemo(
    () =>
      [
        {
          name: ALL_CATEGORIES,
          count: enhancedProducts.length,
        },
        ...CATEGORY_ORDER.map((name) => ({
        name,
        count: enhancedProducts.filter((item) => item.category === name).length,
        })),
      ].filter((category) => category.count > 0),
    [enhancedProducts],
  )

  useEffect(() => {
    if (!categories.some((category) => category.name === activeCategory)) {
      setActiveCategory(categories[0]?.name ?? ALL_CATEGORIES)
    }
  }, [categories, activeCategory])

  const filteredProducts = useMemo(
    () => {
      if (activeCategory === ALL_CATEGORIES) {
        return enhancedProducts
      }

      return enhancedProducts.filter((item) => item.category === activeCategory)
    },
    [enhancedProducts, activeCategory],
  )

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts]
    const targetColumn = SORTABLE_COLUMNS.find(
      (column) => column.key === sortConfig.key,
    )

    if (!targetColumn) {
      return sorted
    }

    sorted.sort((a, b) => {
      const left = a[sortConfig.key]
      const right = b[sortConfig.key]

      if (targetColumn.type === 'string') {
        const compared = String(left).localeCompare(String(right), 'ja')
        return sortConfig.direction === 'asc' ? compared : -compared
      }

      const compared = Number(left) - Number(right)
      return sortConfig.direction === 'asc' ? compared : -compared
    })

    return sorted
  }, [filteredProducts, sortConfig])

  const handleSort = (key) => {
    setSortConfig((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        }
      }

      return {
        key,
        direction: 'asc',
      }
    })
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Protein Price Compare</p>
        <h1>プロテイン比較</h1>
        <p className="lead">
          価格と成分を見比べられるサイトを作成しました。
        </p>
      </header>

      <section className="category-filter" aria-label="カテゴリ選択">
        {categories.map((category) => (
          <button
            key={category.name}
            type="button"
            className={`category-pill ${
              activeCategory === category.name ? 'active' : ''
            }`}
            onClick={() => setActiveCategory(category.name)}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </section>

      <section className="panel category-guide">
        <div className="panel-head">
          <h2>カテゴリ紹介</h2>
        </div>

        <div className="guide-grid">
          <article className="guide-card active">
            <h3>{activeCategory}</h3>
            <p>{CATEGORY_DESCRIPTIONS[activeCategory]}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>詳細比較</h2>
          <p>{activeCategory}を横並びで比較できます。ヘッダーでソート可能です。</p>
        </div>

        {loading && <p className="status">読み込み中...</p>}
        {error && <p className="status error">{error}</p>}
        {!loading && !error && filteredProducts.length === 0 && (
          <p className="status">このカテゴリの商品データはありません。</p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {SORTABLE_COLUMNS.map((column) => {
                  const isActive = sortConfig.key === column.key
                  const directionMark =
                    !isActive ? '↕' : sortConfig.direction === 'asc' ? '↑' : '↓'

                  return (
                    <th key={column.key}>
                      <button
                        type="button"
                        className={`sort-button ${isActive ? 'active' : ''}`}
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                        <span aria-hidden="true">{directionMark}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((item) => (
                <tr key={`${item.id}-row`}>
                  <td>{item.category}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.brand}</span>
                  </td>
                  <td>{item.weightG}g</td>
                  <td>{formatYen(item.priceYen)}</td>
                  <td>{item.servingSizeG}g</td>
                  <td>{item.proteinPerServing}g</td>
                  <td>{formatYen(item.powderPricePerGram)}</td>
                  <td>{formatYen(item.proteinPricePerGram)}</td>
                  <td>{formatYen(item.pricePerServing)}</td>
                  <td>{item.sweetener}</td>
                  <td>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.sourceName || '出典'}
                      </a>
                    ) : (
                      item.sourceName || '出典なし'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <p></p>
      </footer>
    </main>
  )
}

export default App
