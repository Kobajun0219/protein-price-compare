async function fetchItems(options = {}) {
  if (!options.url) {
    throw new Error('jsonUrl provider requires url option')
  }

  const response = await fetch(options.url)

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }

  const payload = await response.json()

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload.items)) {
    return payload.items
  }

  throw new Error('Invalid JSON format: expected array or { items: [] }')
}

module.exports = {
  name: 'jsonUrl',
  fetchItems,
}
