import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { AdminPage } from './pages/AdminPage'
import { CalculatorPage } from './pages/CalculatorPage'
import { ChatPage } from './pages/ChatPage'
import { ChecklistPage } from './pages/ChecklistPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="checklist" element={<ChecklistPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
