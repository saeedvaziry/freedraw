import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { BoardRoute } from './routes/BoardRoute.js'

const router = createBrowserRouter([
  {
    path: '/',
    element: <BoardRoute />,
  },
])

export function App() {
  return <RouterProvider router={router} />
}
