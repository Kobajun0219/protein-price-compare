const proteins = require('../../data/proteins')

async function fetchItems() {
  return proteins
}

module.exports = {
  name: 'mock',
  fetchItems,
}
