import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlusCircle, CalendarDays, LayoutGrid, Package,
  Sparkles, Wallet, TrendingUp, FolderOpen, History, Users,
  ChevronLeft, ChevronRight, Droplets, Menu, X,
  Lock, Unlock, ShieldCheck,
} from 'lucide-react'
import { cn } from './ui/cn'

const ADMIN_PASSWORD = 'BDCP123'
const SESSION_KEY    = 'bdcpolo_admin_unlocked'

const publicNav = [
  { to: '/',               icon: PlusCircle,   label: 'Ingresar Servicio' },
  { to: '/calendario',     icon: CalendarDays, label: 'Citas' },
  { to: '/patio',          icon: LayoutGrid,   label: 'Estado Patio' },
  { to: '/inventario',     icon: Package,      label: 'Inventario' },
  { to: '/ceramicos',      icon: Sparkles,     label: 'Cerámicos' },
  { to: '/historial',      icon: History,      label: 'Historial' },
  { to: '/clientes',       icon: Users,        label: 'Clientes' },
  { to: '/mi-liquidacion', icon: ShieldCheck,  label: 'Mi Liquidación' },
]

const restrictedNav = [
  { to: '/liquidacion',      icon: Wallet,     label: 'Liquidación' },
  { to: '/ingresos-egresos', icon: TrendingUp, label: 'Ingresos / Egresos' },
  { to: '/documentos',       icon: FolderOpen, label: 'Documentos' },
]

// ── Password modal ────────────────────────────────────────────────────────────

function AdminPasswordModal({
  open,
  onClose,
  onUnlock,
}: {
  open: boolean
  onClose: () => void
  onUnlock: () => void
}) {
  const [pwd,   setPwd]   = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPwd('')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pwd === ADMIN_PASSWORD) {
      onUnlock()
      setPwd('')
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPwd('')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-yellow-500/10 p-4">
              <Lock size={30} className="text-yellow-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white">Zona Administrativa</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresa la clave para desbloquear</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <motion.input
              ref={inputRef}
              animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-gray-100 placeholder:text-gray-600 tracking-widest focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-gray-950 hover:bg-yellow-400 transition-colors"
            >
              Desbloquear
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

// ── Nav link (generic) ────────────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, collapsed, onClick,
}: {
  to: string
  icon: React.ElementType
  label: string
  collapsed?: boolean
  onClick?: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      title={collapsed ? label : ''}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
        isActive
          ? 'bg-yellow-500/12 text-yellow-400 border-l-2 border-yellow-500 pl-[10px]'
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/6 border-l-2 border-transparent',
      )}
    >
      <Icon
        size={18}
        className={cn(
          'shrink-0 transition-colors',
          isActive ? 'text-yellow-400' : 'text-gray-400 group-hover:text-gray-200',
        )}
      />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )
}

// ── Restricted nav item (intercepts click when locked) ────────────────────────

function RestrictedNavItem({
  to, icon: Icon, label, collapsed, adminUnlocked, onLockedClick, onClick,
}: {
  to: string
  icon: React.ElementType
  label: string
  collapsed?: boolean
  adminUnlocked: boolean
  onLockedClick: (route: string) => void
  onClick?: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === to

  if (adminUnlocked) {
    return (
      <Link
        to={to}
        title={collapsed ? label : ''}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
          isActive
            ? 'bg-yellow-500/12 text-yellow-400 border-l-2 border-yellow-500 pl-[10px]'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/6 border-l-2 border-transparent',
        )}
      >
        <Icon
          size={18}
          className={cn(
            'shrink-0 transition-colors',
            isActive ? 'text-yellow-400' : 'text-gray-400 group-hover:text-gray-200',
          )}
        />
        {!collapsed && <span className="text-sm font-medium">{label}</span>}
      </Link>
    )
  }

  return (
    <button
      onClick={() => onLockedClick(to)}
      title={collapsed ? label : ''}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
        'text-gray-500 hover:text-gray-300 hover:bg-white/4 border-l-2 border-transparent',
      )}
    >
      <Icon size={18} className="shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors" />
      {!collapsed && (
        <span className="text-sm font-medium flex-1 text-left">{label}</span>
      )}
      {!collapsed && <Lock size={12} className="text-gray-600 shrink-0" />}
    </button>
  )
}

// ── Admin section divider ─────────────────────────────────────────────────────

function AdminDivider({
  collapsed,
  adminUnlocked,
  onLock,
  onUnlockClick,
}: {
  collapsed: boolean
  adminUnlocked: boolean
  onLock: () => void
  onUnlockClick: () => void
}) {
  if (collapsed) {
    return (
      <div className="px-2 py-1">
        <button
          onClick={adminUnlocked ? onLock : onUnlockClick}
          title={adminUnlocked ? 'Bloquear zona admin' : 'Desbloquear zona admin'}
          className={cn(
            'w-full flex justify-center rounded-xl p-2 transition-colors',
            adminUnlocked
              ? 'text-yellow-500 hover:bg-yellow-500/10'
              : 'text-gray-600 hover:bg-white/6 hover:text-gray-400',
          )}
        >
          {adminUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
        </button>
      </div>
    )
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center justify-between gap-2 px-1 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Admin
        </span>
        <button
          onClick={adminUnlocked ? onLock : onUnlockClick}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors',
            adminUnlocked
              ? 'text-yellow-500 hover:bg-yellow-500/10'
              : 'text-gray-600 hover:bg-white/6 hover:text-gray-400',
          )}
        >
          {adminUnlocked ? (
            <><Unlock size={10} /> Bloquear</>
          ) : (
            <><Lock size={10} /> Bloqueado</>
          )}
        </button>
      </div>
      <div className="h-px bg-white/6" />
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [collapsed,     setCollapsed]     = useState(true)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [isMobile,      setIsMobile]      = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  const [adminUnlocked, setAdminUnlocked] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) === '1' : false
  )
  const [pwdModalOpen,  setPwdModalOpen]  = useState(false)
  const [pendingRoute,  setPendingRoute]  = useState<string | null>(null)

  const location = useLocation()
  const navigate  = useNavigate()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  function handleUnlock() {
    setAdminUnlocked(true)
    sessionStorage.setItem(SESSION_KEY, '1')
    setPwdModalOpen(false)
    if (pendingRoute) {
      navigate(pendingRoute)
      setPendingRoute(null)
    }
  }

  function handleLock() {
    setAdminUnlocked(false)
    sessionStorage.removeItem(SESSION_KEY)
    // If currently on a restricted page, redirect home
    const isOnRestricted = restrictedNav.some(n => location.pathname === n.to)
    if (isOnRestricted) navigate('/')
  }

  function handleLockedClick(route: string) {
    setPendingRoute(route)
    setPwdModalOpen(true)
    setMobileOpen(false)
  }

  const sidebarW = isMobile ? 0 : (collapsed ? 64 : 256)

  return (
    <div className="flex min-h-screen bg-gray-950 overflow-x-hidden">

      {/* ── Password modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pwdModalOpen && (
          <AdminPasswordModal
            open={pwdModalOpen}
            onClose={() => { setPwdModalOpen(false); setPendingRoute(null) }}
            onUnlock={handleUnlock}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
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

      {/* ── Mobile nav overlay ───────────────────────────────────────────────── */}
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
                {publicNav.map(item => (
                  <NavItem
                    key={item.to}
                    {...item}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
                <AdminDivider
                  collapsed={false}
                  adminUnlocked={adminUnlocked}
                  onLock={handleLock}
                  onUnlockClick={() => { setMobileOpen(false); setPwdModalOpen(true) }}
                />
                {restrictedNav.map(item => (
                  <RestrictedNavItem
                    key={item.to}
                    {...item}
                    adminUnlocked={adminUnlocked}
                    onLockedClick={handleLockedClick}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
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
          {publicNav.map(item => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          <AdminDivider
            collapsed={collapsed}
            adminUnlocked={adminUnlocked}
            onLock={handleLock}
            onUnlockClick={() => setPwdModalOpen(true)}
          />

          {restrictedNav.map(item => (
            <RestrictedNavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              adminUnlocked={adminUnlocked}
              onLockedClick={handleLockedClick}
            />
          ))}
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

      {/* ── Main content ─────────────────────────────────────────────────────── */}
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
