import client from './client'

export const searchGenotype = (genotype: string) =>
  client.get('/search_genotype', { params: { genotype } }).then((r) => r.data)

export const spellCheck = (genotype: string) =>
  client.post('/spell_check', { genotype }).then((r) => r.data)

export const populateGenotypes = () =>
  client.post('/populate_genotypes').then((r) => r.data)
