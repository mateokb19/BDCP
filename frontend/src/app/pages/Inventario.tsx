import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Plus, Search, Edit2, Package, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Modal } from '@/app/components/ui/Modal'
import { Badge } from '@/app/components/ui/Badge'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { mockInventoryItems, mockInventoryCategories, getInventoryCategoryName } from '@/data/mock'
import type { InventoryItem } from '@/types'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const row = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }

function StockBar({ quantity, minStock }: { quantity: number; minStock: number }) {
  const max   = Math.max(minStock * 3, quantity)
  const pct   = Math.min((quantity / max) * 100, 100)
  const color = quantity <= minStock ? 'bg-red-500' : quantity <= minStock * 1.5 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className={cn('text-xs font-medium', quantity <= minStock ? 'text-red-400' : quantity <= minStock * 1.5 ? 'text-yellow-400' : 'text-gray-400')}>
        {quantity}
      </span>
    </div>
  )
}

const emptyForm = (): Omit<InventoryItem, 'id'> => ({
  name: '', category_id: undefined, description: '',
  quantity: 0, unit: 'unidades', min_stock: 0, cost_per_unit: undefined,
  updated_at: new Date().toISOString(),
})

export default function Inventario() {
  const [items, setItems]          = useState<InventoryItem[]>(mockInventoryItems)
  const [search, setSearch]        = useState('')
  const [catFilter, setCatFilter]  = useState<number | 'all'>('all')
  const [showBanner, setShowBanner]= useState(true)
  const [showModal, setShowModal]  = useState(false)
  const [editing, setEditing]      = useState<InventoryItem | null>(null)
  const [form, setForm]            = useState(emptyForm())

  const lowStock = items.filter(i => i.quantity <= i.min_stock)

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat    = catFilter === 'all' || i.category_id === catFilter
    return matchSearch && matchCat
  })

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({ ...item })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.name) { toast.error('El nombre es obligatorio'); return }
    if (editing) {
      setItems(prev => prev.map(i => i.id === editing.id ? { ...editing, ...form, updated_at: new Date().toISOString() } : i))
      toast.success('Ítem actualizado')
    } else {
      const newItem: InventoryItem = { id: items.length + 1, ...form, updated_at: new Date().toISOString() }
      setItems(prev => [...prev, newItem])
      toast.success('Ítem agregado al inventario')
    }
    setShowModal(false)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Inventario"
        subtitle={`${items.length} ítems · ${lowStock.length} con stock bajo`}
        actions={
          <Button variant="primary" size="md" onClick={openAdd}>
            <Plus size={16} /> Agregar Ítem
          </Button>
        }
      />

      {/* Low stock banner */}
      <AnimatePresence>
        {showBanner && lowStock.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/8 px-4 py-3">
              <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-400">Stock bajo detectado</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">
                  {lowStock.map(i => i.name).join(', ')}
                </p>
              </div>
              <button onClick={() => setShowBanner(false)} className="text-yellow-400/50 hover:text-yellow-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ítem..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCatFilter('all')}
            className={cn('rounded-xl px-3 py-2 text-sm transition-colors', catFilter === 'all' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-gray-400 hover:bg-white/8')}>
            Todos
          </button>
          {mockInventoryCategories.map(cat => (
            <button key={cat.id} onClick={() => setCatFilter(cat.id)}
              className={cn('rounded-xl px-3 py-2 text-sm transition-colors', catFilter === cat.id ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-gray-400 hover:bg-white/8')}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Mínimo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Costo/u</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <motion.tbody variants={stagger} initial="hidden" animate="show">
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Package} title="Sin resultados" description="Intenta con otro filtro" /></td></tr>
              ) : (
                filtered.map(item => {
                  const isLow = item.quantity <= item.min_stock
                  return (
                    <motion.tr key={item.id} variants={row}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {isLow && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          <div>
                            <div className="text-white font-medium">{item.name}</div>
                            {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{getInventoryCategoryName(item.category_id)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StockBar quantity={item.quantity} minStock={item.min_stock} />
                      </td>
                      <td className="px-4 py-3 text-gray-400">{item.min_stock}</td>
                      <td className="px-4 py-3 text-gray-400">{item.unit}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {item.cost_per_unit != null ? `$${item.cost_per_unit}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {format(parseISO(item.updated_at), 'd MMM', { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </motion.tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Ítem' : 'Nuevo Ítem'} size="md">
        <div className="p-6 space-y-4">
          <Input label="Nombre *" id="item-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Categoría</label>
            <select value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20">
              <option value="">Sin categoría</option>
              {mockInventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Descripción" id="item-desc" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad" id="item-qty" type="number" value={String(form.quantity)} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            <Input label="Stock Mínimo" id="item-min" type="number" value={String(form.min_stock)} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unidad" id="item-unit" value={form.unit} placeholder="litros, unidades, kg..." onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            <Input label="Costo por unidad" id="item-cost" type="number" value={String(form.cost_per_unit ?? '')} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
