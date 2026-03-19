import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from '@/app/routes'
import { AppProvider } from '@/app/context/AppContext'
import '@/styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
    <Toaster
      richColors
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f9fafb',
        },
      }}
    />
  </React.StrictMode>
)
