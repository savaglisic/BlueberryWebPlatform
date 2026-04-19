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
import { useUser } from './context/UserContext'
import { Overview } from './pages/Overview'

function AdminRoute({ element }: { element: React.ReactElement }) {
  const { isAdmin, loading } = useUser()
  if (loading) return null
  return isAdmin ? element : <Navigate to="/add-samples" replace />
}

function DefaultRoute() {
  const { isAdmin, loading } = useUser()
  if (loading) return null
  return <Navigate to={isAdmin ? '/overview' : '/add-samples'} replace />
}

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
              <Route path="/" element={<DefaultRoute />} />
              <Route path="/login" element={<DefaultRoute />} />
              <Route path="/add-samples" element={<AddSamples />} />
              <Route path="/overview" element={<AdminRoute element={<Overview />} />} />
              <Route path="/fq-lab" element={<FQLab />} />
              <Route path="/fq-database" element={<AdminRoute element={<FQDatabase />} />} />
              <Route path="/fq-database/yield-summary" element={<AdminRoute element={<FQDatabase />} />} />
              <Route path="/search-pedigree" element={<AdminRoute element={<SearchPedigree />} />} />
              <Route path="/sensory-panels" element={<AdminRoute element={<SensoryPanels />} />} />
              <Route path="/configure" element={<AdminRoute element={<Configure />} />} />
              <Route path="*" element={<DefaultRoute />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
