import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from '@freedraw/ui'
import { BoardRoute } from './routes/BoardRoute.js'

const router = createBrowserRouter([
  {
    path: '/',
    element: <BoardRoute />,
  },
])

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
