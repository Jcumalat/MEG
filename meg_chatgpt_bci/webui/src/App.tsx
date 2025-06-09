import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Training from './pages/Training'
import Monitoring from './pages/Monitoring'
import Configuration from './pages/Configuration'
import Analysis from './pages/Analysis'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/training" element={<Training />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/analysis" element={<Analysis />} />
      </Routes>
    </Layout>
  )
}

export default App
