import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { AddSamples } from './pages/AddSamples'
import { FQLab } from './pages/FQLab'
import { FQDatabase } from './pages/FQDatabase'
import { SearchPedigree } from './pages/SearchPedigree'
import { Configure } from './pages/Configure'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/add-samples" replace />} />
                <Route path="/add-samples" element={<AddSamples />} />
                <Route path="/fq-lab" element={<FQLab />} />
                <Route
                  path="/fq-database"
                  element={<ProtectedRoute adminOnly><FQDatabase /></ProtectedRoute>}
                />
                <Route
                  path="/search-pedigree"
                  element={<ProtectedRoute adminOnly><SearchPedigree /></ProtectedRoute>}
                />
                <Route
                  path="/configure"
                  element={<ProtectedRoute adminOnly><Configure /></ProtectedRoute>}
                />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
