import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { CalculatorPage } from './pages/CalculatorPage'
import { ChatPage } from './pages/ChatPage'
import { ChecklistPage } from './pages/ChecklistPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/calculator" replace />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="checklist" element={<ChecklistPage />} />
        <Route path="*" element={<Navigate to="/calculator" replace />} />
      </Route>
    </Routes>
  )
}
