import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Image, Sheet, File, Download, Eye, Upload,
  Search, FolderOpen, CloudUpload,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Modal } from '@/app/components/ui/Modal'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { mockDocuments } from '@/data/mock'
import type { Document } from '@/types'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const cardAnim = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.2 } } }

type DocType = 'contrato' | 'factura' | 'recibo' | 'otro'

const typeConfig: Record<DocType | string, { label: string; variant: 'default' | 'yellow' | 'green' | 'red' | 'blue' | 'orange' | 'purple' }> = {
  contrato: { label: 'Contrato', variant: 'yellow' },
  factura:  { label: 'Factura',  variant: 'blue'   },
  recibo:   { label: 'Recibo',   variant: 'green'  },
  otro:     { label: 'Otro',     variant: 'default' },
}

const relatedConfig: Record<string, string> = {
  order:   'Orden',
  vehicle: 'Vehículo',
  client:  'Cliente',
  general: 'General',
}

function getFileIcon(mime?: string) {
  if (!mime) return <File size={32} className="text-gray-400" />
  if (mime.includes('pdf'))   return <FileText size={32} className="text-red-400" />
  if (mime.includes('image')) return <Image    size={32} className="text-blue-400" />
  if (mime.includes('sheet') || mime.includes('excel')) return <Sheet size={32} className="text-green-400" />
  return <File size={32} className="text-gray-400" />
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Documentos() {
  const [docs, setDocs]           = useState<Document[]>(mockDocuments)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    name: '', type: 'otro', related_to: 'general', notes: '',
  })
  const dropRef = useRef<HTMLDivElement>(null)

  const filtered = docs.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter === 'all' || d.type === typeFilter
    return matchSearch && matchType
  })

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(true)
  }
  function handleDragLeave() { setIsDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setUploadForm(f => ({ ...f, name: files[0].name }))
    }
  }

  function handleUpload() {
    if (!uploadForm.name) { toast.error('El nombre del documento es obligatorio'); return }
    const newDoc: Document = {
      id: docs.length + 1,
      name: uploadForm.name,
      type: uploadForm.type,
      file_path: `/docs/${uploadForm.name.toLowerCase().replace(/\s+/g, '-')}`,
      file_size: Math.floor(Math.random() * 500000) + 50000,
      mime_type: uploadForm.name.endsWith('.pdf') ? 'application/pdf'
               : uploadForm.name.endsWith('.jpg') || uploadForm.name.endsWith('.png') ? 'image/jpeg'
               : 'application/octet-stream',
      related_to: uploadForm.related_to,
      notes: uploadForm.notes,
      uploaded_at: new Date().toISOString(),
    }
    setDocs(prev => [newDoc, ...prev])
    toast.success('Documento registrado correctamente')
    setShowModal(false)
    setUploadForm({ name: '', type: 'otro', related_to: 'general', notes: '' })
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Documentos"
        subtitle={`${docs.length} archivos registrados`}
        actions={
          <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
            <Upload size={16} /> Subir Documento
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'contrato', 'factura', 'recibo', 'otro'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('rounded-xl px-3 py-2 text-sm transition-colors capitalize',
                typeFilter === t ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-gray-400 hover:bg-white/8')}>
              {t === 'all' ? 'Todos' : typeConfig[t]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Sin documentos" description="Sube un archivo para comenzar"
            action={<Button variant="primary" size="md" onClick={() => setShowModal(true)}><Upload size={16} /> Subir</Button>} />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(doc => {
              const tc = typeConfig[doc.type ?? 'otro'] ?? typeConfig['otro']
              return (
                <motion.div key={doc.id} variants={cardAnim} layout>
                  <GlassCard padding hover className="flex flex-col gap-3">
                    {/* File icon */}
                    <div className="flex items-center justify-between">
                      <div className="rounded-xl bg-white/5 p-3">
                        {getFileIcon(doc.mime_type)}
                      </div>
                      <Badge variant={tc.variant}>{tc.label}</Badge>
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{doc.name}</p>
                      <div className="mt-1.5 space-y-0.5">
                        {doc.file_size && (
                          <p className="text-xs text-gray-600">{formatSize(doc.file_size)}</p>
                        )}
                        {doc.related_to && (
                          <p className="text-xs text-gray-600">
                            {relatedConfig[doc.related_to] ?? doc.related_to}
                            {doc.related_id ? ` #${doc.related_id}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-700">
                          {format(parseISO(doc.uploaded_at), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>

                    {doc.notes && (
                      <p className="text-xs text-gray-600 border-t border-white/6 pt-2">{doc.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-white/6">
                      <button
                        onClick={() => toast.info('Vista previa disponible con backend')}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/8 transition-colors">
                        <Eye size={13} /> Ver
                      </button>
                      <button
                        onClick={() => toast.info('Descarga disponible con backend')}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/8 transition-colors">
                        <Download size={13} /> Descargar
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Subir Documento" size="md">
        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              isDragging
                ? 'border-yellow-500/60 bg-yellow-500/8'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]'
            )}
          >
            <CloudUpload size={36} className={cn('mx-auto mb-3', isDragging ? 'text-yellow-400' : 'text-gray-600')} />
            <p className="text-sm text-gray-400">Arrastra un archivo aquí</p>
            <p className="text-xs text-gray-600 mt-1">o selecciona desde tu dispositivo</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/8 transition-colors">
              <Upload size={14} /> Seleccionar archivo
              <input type="file" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (file) setUploadForm(f => ({ ...f, name: file.name }))
              }} />
            </label>
          </div>

          <Input label="Nombre del documento *" id="doc-name" value={uploadForm.name}
            onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Tipo</label>
              <select value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}
                className="w-full appearance-none rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20">
                <option value="contrato">Contrato</option>
                <option value="factura">Factura</option>
                <option value="recibo">Recibo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Relacionado con</label>
              <select value={uploadForm.related_to} onChange={e => setUploadForm(f => ({ ...f, related_to: e.target.value }))}
                className="w-full appearance-none rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20">
                <option value="general">General</option>
                <option value="order">Orden</option>
                <option value="vehicle">Vehículo</option>
                <option value="client">Cliente</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Notas</label>
            <textarea value={uploadForm.notes} rows={2} placeholder="Descripción opcional..."
              onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleUpload}>
              <Upload size={16} /> Subir Documento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
