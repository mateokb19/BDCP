import { createBrowserRouter } from 'react-router'
import Layout from '@/app/components/Layout'
import IngresarServicio  from '@/app/pages/IngresarServicio'
import CalendarioCitas   from '@/app/pages/CalendarioCitas'
import EstadoPatio       from '@/app/pages/EstadoPatio'
import Inventario        from '@/app/pages/Inventario'
import Ceramicos         from '@/app/pages/Ceramicos'
import Liquidacion       from '@/app/pages/Liquidacion'
import IngresosEgresos   from '@/app/pages/IngresosEgresos'
import Documentos        from '@/app/pages/Documentos'
import Historial         from '@/app/pages/Historial'
import Clientes          from '@/app/pages/Clientes'
import MiLiquidacion     from '@/app/pages/MiLiquidacion'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,               element: <IngresarServicio /> },
      { path: 'calendario',        element: <CalendarioCitas /> },
      { path: 'patio',             element: <EstadoPatio /> },
      { path: 'inventario',        element: <Inventario /> },
      { path: 'ceramicos',         element: <Ceramicos /> },
      { path: 'liquidacion',       element: <Liquidacion /> },
      { path: 'ingresos-egresos',  element: <IngresosEgresos /> },
      { path: 'documentos',        element: <Documentos /> },
      { path: 'historial',         element: <Historial /> },
      { path: 'clientes',          element: <Clientes /> },
      { path: 'mi-liquidacion',    element: <MiLiquidacion /> },
    ],
  },
])
