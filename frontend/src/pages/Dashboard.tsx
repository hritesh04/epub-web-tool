import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, 
  BookOpen, 
  Clock, 
  FileText, 
  Loader2, 
  Search, 
  Upload, 
  X,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import axios, { type AxiosProgressEvent } from 'axios'

import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BookCard, type TranslationJob, type TranslationStatus } from '@/components/dashboard/BookCard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024 // 1GB

const TARGET_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
] as const

// Moved to BookCard.tsx
// type TranslationJob = { ... }

const mapTranslationJob = (data: any): TranslationJob => {
  return {
    id: data.id || data.ID || '',
    title: data.title || data.Title || 'Untitled Book',
    size: data.size || data.Size || 0,
    translateTo: data.translateTo || data.TranslateTo || '',
    status: (data.status || data.Status || 'queued').toLowerCase() as TranslationStatus,
    userID: data.userID || data.UserID || '',
    chunkCount: data.chunkCount || data.ChunkCount || 0,
    createdAt: data.createdAt || data.CreatedAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.UpdatedAt || '',
    objectKey: data.objectKey ||''
  }
}

type UploadValues = {
  key: string;
  policy: string;
  'X-Amz-Algorithm': string;
  'X-Amz-Credential': string;
  'X-Amz-Date': string;
  'X-Amz-Signature': string;
}

type UploadUrlResponse = {
  success: boolean;
  data: {
    URL: string;
    Values: UploadValues;
  }
}

export default function Dashboard() {
  const [translationLibrary, setTranslationLibrary] = useState<TranslationJob[]>([])
  const [epubsLoading, setEpubsLoading] = useState(true)
  const [epubsError, setEpubsError] = useState<string | null>(null)
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [uploadFieldValues, setUploadFieldValues] = useState<UploadValues | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetLanguage, setTargetLanguage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchLibrary = useCallback(async () => {
    setEpubsLoading(true)
    setEpubsError(null)
    try {
      const res = await api.get<any>('/epubs')
      const env = res.data
      const rawList = Array.isArray(env) ? env : (env?.data || [])
      const list = (Array.isArray(rawList) ? rawList : [])
        .map(mapTranslationJob)
        .filter(job => job.title.trim() !== '')
      setTranslationLibrary(list)
    } catch (err: any) {
      setEpubsError(err.response?.data?.message ?? 'Failed to load library.')
    } finally {
      setEpubsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const validateFile = useCallback((file: File) => {
    if (!(file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      setUploadError('Please select a valid EPUB file.')
      return false
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Max file size is 1GB.')
      return false
    }
    return true
  }, [])

  const openUploadModal = useCallback(async () => {
    setUploadError(null)
    setSelectedFile(null)
    setTargetLanguage('')
    setUploadProgress(0)
    setFetchingUrl(true)
    try {
      const { data } = await api.get<UploadUrlResponse>('/upload')
      if (!data.success) {
        setUploadError('Internal server error, Please try again later')
        return
      }
      setUploadUrl(data.data.URL)
      setUploadFieldValues(data.data.Values)
      setUploadModalOpen(true)
    } catch (err: any) {
      setUploadError(err.response?.data?.message ?? 'Could not get upload URL')
      setUploadModalOpen(true)
    } finally {
      setFetchingUrl(false)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadError(null)
      if (validateFile(file)) setSelectedFile(file)
    }
    e.target.value = ''
  }, [validateFile])

  const startUpload = useCallback(async () => {
    if (!uploadUrl || !selectedFile || !targetLanguage) return
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)

    const form = new FormData()
    form.append('key', uploadFieldValues?.key ?? '')
    form.append("Content-Type", "application/epub+zip")
    form.append('policy', uploadFieldValues?.policy ?? '')
    form.append('X-Amz-Algorithm', uploadFieldValues?.['X-Amz-Algorithm'] ?? '')
    form.append('X-Amz-Credential', uploadFieldValues?.['X-Amz-Credential'] ?? '')
    form.append('X-Amz-Date', uploadFieldValues?.['X-Amz-Date'] ?? '')
    form.append('X-Amz-Signature', uploadFieldValues?.['X-Amz-Signature'] ?? '')
    form.append('file', selectedFile)

    try {
      // Use original axios for S3 upload to avoid base URL interceptors
      const res = await axios.post(uploadUrl, form, {
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      if (res.status === 204) {
        const finishRes = await api.post(`/upload/${uploadFieldValues?.key}`, {
          title: selectedFile.name,
          size: selectedFile.size,
          objectKey: uploadFieldValues?.key,
          translateTo: targetLanguage,
        })
        const resData = finishRes.data
        const bookData = (resData?.success && resData?.data) ? resData.data : resData
        
        if (bookData && bookData.id) {
          setTranslationLibrary((prev) => {
            const index = prev.findIndex(item => item.id === bookData.id)
            if (index !== -1) {
              const next = [...prev]
              next[index] = bookData
              return next
            }
            return [...prev, bookData]
          })
        }
        setUploadProgress(100)
        setTimeout(() => setUploadModalOpen(false), 800)
      } else {
        setUploadError('Upload Failed, Please try again')
      }
    } catch (err: any) {
      setUploadError('Upload Failed: ' + (err.response?.data?.message ?? 'Internal server error'))
    } finally {
      setUploading(false)
    }
  }, [uploadUrl, selectedFile, uploadFieldValues, targetLanguage])

  const handleDeleteBook = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return
    }
    try {
      await api.delete(`/epub/${id}`)
      setTranslationLibrary((prev) => prev.filter(book => book.id !== id))
    } catch (err: any) {
      setEpubsError(err.response?.data?.message ?? 'Failed to delete book.')
    }
  }, [])

  const filteredLibrary = translationLibrary.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col pt-20">
      <div className="container px-4 mx-auto pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <BookOpen className="h-3 w-3" />
              Your Library
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              Welcome Back
            </h1>
            <p className="text-muted-foreground max-w-lg">
              Manage your translations, track progress, and download your polished books from one central workspace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Find a book..."
                className="pl-10 w-full md:w-64 h-11 bg-background/50 border-border/50 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button size="lg" className="h-11 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2" onClick={openUploadModal} disabled={fetchingUrl}>
              {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New Book
            </Button>
          </div>
        </div>

        {/* Library Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-24 flex items-center p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{translationLibrary.length}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Books</div>
              </div>
            </div>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-24 flex items-center p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{translationLibrary.filter(b => b.status === 'in-progress').length}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Progress</div>
              </div>
            </div>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-24 flex items-center p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{translationLibrary.filter(b => b.status === 'completed').length}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Completed</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Error State */}
        {epubsError && (
          <div className="mb-8 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p>{epubsError}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchLibrary} className="h-8 hover:bg-destructive/20 text-destructive">
              Retry
            </Button>
          </div>
        )}

        {/* Library Grid */}
        <AnimatePresence mode="popLayout">
      {epubsLoading ? (
            <motion.div 
              key="loading-spinner"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Syncing your library...</p>
            </motion.div>
          ) : filteredLibrary.length > 0 ? (
            <motion.div 
              key="library-grid"
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                visible: { 
                  opacity: 1,
                  transition: { staggerChildren: 0.1, delayChildren: 0.2 } 
                }
              }}
            >
              {filteredLibrary.map((book) => (
                <BookCard key={book.id} book={book} onDelete={handleDeleteBook} />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No books found</h3>
              <p className="text-muted-foreground max-w-sm mb-8">
                Your library is currently empty. Upload your first EPUB to start translating or editing.
              </p>
              <Button size="lg" className="rounded-xl gap-2" onClick={openUploadModal}>
                <Plus className="h-4 w-4" />
                Upload My First Book
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => !uploading && setUploadModalOpen(open)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-card/60 backdrop-blur-2xl">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-2xl font-bold">Upload EPUB</DialogTitle>
            <DialogDescription>
              Select your file and target language to start the process.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-0 space-y-6">
            {uploadError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {uploadError}
              </div>
            )}

            {!selectedFile ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Translate to</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger className="h-12 bg-background/50 rounded-xl border-border/50">
                      <SelectValue placeholder="Select a language..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div
                  className={cn(
                    "relative group cursor-pointer rounded-2xl border-2 border-dashed border-border/50 bg-background/30 p-12 transition-all text-center",
                    "hover:border-primary/50 hover:bg-primary/5",
                    !targetLanguage && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => targetLanguage && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={!targetLanguage}
                  />
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 transition-transform group-hover:scale-110">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="font-semibold text-foreground">Drag and drop file</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative p-4 rounded-2xl border border-border/50 bg-background/50 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate uppercase tracking-tight">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  {!uploading && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Target Language</span>
                      <span className="font-bold text-primary">
                        {TARGET_LANGUAGES.find(l => l.value === targetLanguage)?.label}
                      </span>
                    </div>
                  </div>

                  {uploading ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Uploading your book...</span>
                        <span className="font-bold">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  ) : (
                    <Button className="w-full h-12 rounded-xl text-lg font-semibold shadow-lg shadow-primary/20" onClick={startUpload}>
                      Start Upload
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
