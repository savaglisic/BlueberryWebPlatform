import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AddSamples } from './pages/AddSamples'
import { FQLab } from './pages/FQLab'
import { FQDatabase } from './pages/FQDatabase'
import { SearchPedigree } from './pages/SearchPedigree'
import { Configure } from './pages/Configure'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/add-samples" replace />} />
        <Route path="/login" element={<Navigate to="/add-samples" replace />} />
        <Route path="/add-samples" element={<AddSamples />} />
        <Route path="/fq-lab" element={<FQLab />} />
        <Route path="/fq-database" element={<FQDatabase />} />
        <Route path="/search-pedigree" element={<SearchPedigree />} />
        <Route path="/configure" element={<Configure />} />
        <Route path="*" element={<Navigate to="/add-samples" replace />} />
      </Routes>
    </Layout>
  )
}
