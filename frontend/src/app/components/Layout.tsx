import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlusCircle, CalendarDays, LayoutGrid, Package,
  Sparkles, Wallet, TrendingUp, FolderOpen, History,
  ChevronLeft, ChevronRight, Droplets, Menu, X,
} from 'lucide-react'
import { cn } from './ui/cn'

const navItems = [
  { to: '/',                icon: PlusCircle,   label: 'Ingresar Servicio' },
  { to: '/calendario',      icon: CalendarDays, label: 'Citas' },
  { to: '/patio',           icon: LayoutGrid,   label: 'Estado Patio' },
  { to: '/inventario',      icon: Package,      label: 'Inventario' },
  { to: '/ceramicos',       icon: Sparkles,     label: 'Cerámicos' },
  { to: '/liquidacion',     icon: Wallet,       label: 'Liquidación' },
  { to: '/ingresos-egresos',icon: TrendingUp,   label: 'Ingresos / Egresos' },
  { to: '/documentos',      icon: FolderOpen,   label: 'Documentos' },
  { to: '/historial',       icon: History,      label: 'Historial' },
]

function NavLinks({ onClick }: { onClick?: () => void }) {
  const location = useLocation()
  return (
    <>
      {navItems.map(item => {
        const Icon = item.icon
        const isActive = location.pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
              isActive
                ? 'bg-yellow-500/12 text-yellow-400 border-l-2 border-yellow-500 pl-[10px]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/6 border-l-2 border-transparent'
            )}
          >
            <Icon size={18} className={cn('shrink-0 transition-colors', isActive ? 'text-yellow-400' : 'text-gray-400 group-hover:text-gray-200')} />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}

export default function Layout() {
  const [collapsed,   setCollapsed]   = useState(true)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)
  const location = useLocation()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const sidebarW = isMobile ? 0 : (collapsed ? 64 : 256)

  return (
    <div className="flex min-h-screen bg-gray-950">

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-gray-900 border-b border-white/6 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Menu size={22} />
        </button>
        <Droplets size={18} className="text-yellow-400" />
        <span className="font-bold text-yellow-300 tracking-tight text-lg">BDCPolo</span>
      </header>

      {/* ── Mobile nav overlay ───────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[60] flex"
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative z-10 w-[280px] h-full bg-gray-900 border-r border-white/6 flex flex-col"
            >
              <div className="flex items-center justify-between h-14 px-4 border-b border-white/6 shrink-0">
                <div className="flex items-center gap-2">
                  <Droplets size={20} className="text-yellow-400" />
                  <span className="font-bold text-yellow-300 tracking-tight">BDCPolo</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                <NavLinks onClick={() => setMobileOpen(false)} />
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="hidden md:flex fixed left-0 top-0 z-40 h-full overflow-hidden bg-gray-900 border-r border-white/6 flex-col"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 shrink-0 border-b border-white/6">
          <motion.div
            animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap"
          >
            <div className="flex items-center gap-2 mr-3">
              <Droplets size={20} className="text-yellow-400 shrink-0" />
              <span className="text-gradient-yellow font-bold text-lg tracking-tight">BDCPolo</span>
            </div>
          </motion.div>
          {collapsed && (
            <div className="flex items-center justify-center w-full">
              <Droplets size={22} className="text-yellow-400" />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : ''}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
                  isActive
                    ? 'bg-yellow-500/12 text-yellow-400 border-l-2 border-yellow-500 pl-[10px]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/6 border-l-2 border-transparent'
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-yellow-400' : 'text-gray-400 group-hover:text-gray-200'
                  )}
                />
                <motion.span
                  animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap text-sm font-medium overflow-hidden"
                >
                  {item.label}
                </motion.span>
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="shrink-0 p-2 border-t border-white/6">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-xl p-2.5 text-gray-400 hover:text-gray-200 hover:bg-white/6 transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : (
              <>
                <ChevronLeft size={18} />
                <motion.span
                  animate={{ opacity: collapsed ? 0 : 1 }}
                  className="text-sm overflow-hidden whitespace-nowrap"
                >
                  Colapsar
                </motion.span>
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen pt-14 md:pt-0 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarW }}
      >
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
