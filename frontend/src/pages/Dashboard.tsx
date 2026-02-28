import axios, { type AxiosProgressEvent } from 'axios'
import { useCallback, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Clock, FileText, Loader2, Search, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const UPLOAD_URL_API = import.meta.env.VITE_UPLOAD_URL_API || 'http://localhost:3000/upload'
const UPLOAD_FINISH_API = import.meta.env.VITE_UPLOAD_FINISH_API || 'http://localhost:3000/upload'
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1GB

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

type TranslationStatus = 'in-progress' | 'done'

type TranslationJob = {
  title: string
  author: string
  language: string
  status: TranslationStatus
  progress: number
  lastUpdated: string
  size: string
}

const translationLibrary: TranslationJob[] = [
  {
  title: 'testing',
  author: 'testing',
  language: 'testing',
  status: 'in-progress',
  progress: 0,
  lastUpdated: 'testing',
  size: 'testing',
}
] as const

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
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [uploadFieldValues, setUploadFieldValues] = useState<UploadValues | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetLanguage, setTargetLanguage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      const {data} = await axios.get<UploadUrlResponse>(UPLOAD_URL_API)
      if(!data.success){
        setUploadUrl(null)
        setUploadError('Internal server error, Please try again later')
        setUploadFieldValues(null)
        return
      }
      const url = data.data.URL
      if (!url || typeof url !== 'string') throw new Error('Invalid response: missing upload URL')
      setUploadUrl(url)
      setUploadError(null)
      setUploadFieldValues(data.data.Values)
    } catch (err: unknown) {
      setUploadUrl(null)
      setUploadFieldValues(null)
      const message =
        axios.isAxiosError(err) && err.response?.status
          ? `Failed to get upload URL: ${err.response.status}`
          : err instanceof Error
            ? err.message
            : 'Could not get upload URL'
      setUploadError(message)
    } finally {
      setFetchingUrl(false)
      setUploadModalOpen(true)
    }
  }, [])

  const closeUploadModal = useCallback(() => {
    setUploadModalOpen(false)
    setUploadUrl(null)
    setSelectedFile(null)
    setTargetLanguage('')
    setUploadProgress(0)
    setUploading(false)
    setUploadError(null)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadError(null)
      if (validateFile(file)) setSelectedFile(file)
    }
    e.target.value = ''
  }, [validateFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadError(null)
      if (validateFile(file)) setSelectedFile(file)
    }
  }, [validateFile])

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const startUpload = useCallback(async () => {
    if (!uploadUrl || !selectedFile || !targetLanguage) return
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setUploadError('Max file size is 1GB.')
      return
    }
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
      const res = await axios.post(uploadUrl, form, {
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      if (res.status === 204) {
        const finishRes = await axios.post(`${UPLOAD_FINISH_API}/${uploadFieldValues?.key}`,{
          title: selectedFile.name,
          size: selectedFile.size,
          key: uploadFieldValues?.key,
          translate_to: targetLanguage,
        })
        if (finishRes.status !== 200) {
          setUploadError('Upload Failed, Please try again')
          setTimeout(closeUploadModal, 2000)
          return
        }
        translationLibrary.push(finishRes.data.data)
        setUploadProgress(100)
        setTimeout(closeUploadModal, 2000)
      }else{
        setUploadError('Upload Failed, Please try again')
        setTimeout(closeUploadModal, 2000)
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.status === 403 ? 'Upload Failed, Please try again' : 'Internal server error, Please try again later'
      setUploadError(message)
    } finally {
      setUploading(false)
      setTimeout(closeUploadModal, 2000)
    }
  }, [uploadUrl, selectedFile, closeUploadModal, uploadFieldValues, targetLanguage])

  return (
    <div className="flex flex-col bg-background">
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border bg-card shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Upload EPUB</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeUploadModal}
                disabled={uploading}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {uploadError}
                </p>
              )}
              {!uploadUrl ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Close and try again when the server is ready.
                </p>
              ) : !selectedFile ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Translate to</p>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      disabled={uploading}
                      className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-1 text-sm outline-none ring-offset-background',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <option value="" disabled>
                        Select a language…
                      </option>
                      {TARGET_LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl border-2 border-dashed bg-muted/30 px-6 py-10 transition-colors',
                      'hover:border-primary/50 hover:bg-muted/50',
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".epub,application/epub+zip"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-center text-sm font-medium text-foreground">
                      Drag and drop your EPUB here
                    </p>
                    <p className="mt-1 text-center text-xs text-muted-foreground">or</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !targetLanguage}
                    >
                      Browse files
                    </Button>
                    {!targetLanguage && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Choose a target language first.
                      </p>
                    )}
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Max file size: 1GB.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Translate to</p>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      disabled={uploading}
                      className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <option value="" disabled>
                        Select a language…
                      </option>
                      {TARGET_LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-sm font-medium">
                      {selectedFile.name}
                    </span>
                    {!uploading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto shrink-0"
                        onClick={() => setSelectedFile(null)}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={startUpload}
                    disabled={uploading || !targetLanguage}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Max file size: 1GB.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
        <div className="relative flex h-10 flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-2 hidden h-[260px] dark:block"
      >
        <div className="h-full bg-[radial-gradient(900px_360px_at_top,hsl(var(--primary)/0.45),transparent_70%)]" />
      </div>
      </div>
      <main className="flex-1">
        <div className="px-28 py-8 md:py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1.5">
              <Badge variant="outline" className="bg-background/70">
                Library
              </Badge>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Your EPUB shelf
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                See every EPUB that’s currently being translated, watch progress,
                and grab the finished files when they’re ready.
              </p>
            </div>
            <div className="flex w-full max-w-sm items-center gap-2">
              <div className="relative flex-1 w-full">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <Input
                  placeholder="Search Book"
                  className="h-9 pl-9"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={openUploadModal}
                disabled={fetchingUrl}
              >
                {fetchingUrl ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Translate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
              <Button asChild type="button" size="sm" variant="outline" className="gap-1.5">
                <Link to="/editor">
                  Open editor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <section className="mt-6 space-y-4 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {translationLibrary.length} translation jobs
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                  <Clock className="h-3.5 w-3.5" />
                  2 in progress, 1 finished
                </span>
              </div>
            </div>
            {translationLibrary.length == 0 && <div className="text-muted-foreground text-center py-10">No translation jobs found</div>}
            {translationLibrary.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {translationLibrary.map((book) => (
                <Card key={book.title} className="h-full border bg-card/80 backdrop-blur">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="line-clamp-2 text-sm font-semibold">
                          {book.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {book.author}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-dashed text-[11px]">
                        {book.language}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1">
                    <div className="space-y-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {book.size}
                        </span>
                        <span>{book.lastUpdated}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                book.status === 'done'
                                  ? 'bg-emerald-500'
                                  : 'bg-primary',
                              )}
                            />
                            {book.status === 'done'
                              ? 'Finished'
                              : `${book.progress}% translated`}
                          </span>
                          {book.status === 'done' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                            >
                              Download
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">
                              Translating…
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full bg-primary transition-all',
                              book.status === 'done' && 'bg-emerald-500',
                            )}
                            style={{
                              width:
                                book.status === 'done'
                                  ? '100%'
                                  : `${book.progress}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

