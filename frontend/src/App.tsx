import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LayoutPublic } from './components/LayoutPublic'
import { AddSamples } from './pages/AddSamples'
import { FQLab } from './pages/FQLab'
import { FQDatabase } from './pages/FQDatabase'
import { SearchPedigree } from './pages/SearchPedigree'
import { Configure } from './pages/Configure'
import { SensoryPanels } from './pages/SensoryPanels'
import { DeepFlavor } from './pages/DeepFlavor'

export default function App() {
  return (
    <Routes>
      <Route
        path="/fq-lab-public"
        element={<LayoutPublic><FQLab /></LayoutPublic>}
      />
      <Route
        path="/deepflavor"
        element={<LayoutPublic><DeepFlavor /></LayoutPublic>}
      />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/add-samples" replace />} />
              <Route path="/login" element={<Navigate to="/add-samples" replace />} />
              <Route path="/add-samples" element={<AddSamples />} />
              <Route path="/fq-lab" element={<FQLab />} />
              <Route path="/fq-database" element={<FQDatabase />} />
              <Route path="/search-pedigree" element={<SearchPedigree />} />
              <Route path="/sensory-panels" element={<SensoryPanels />} />
              <Route path="/configure" element={<Configure />} />
              <Route path="*" element={<Navigate to="/add-samples" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
