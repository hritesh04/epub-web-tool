import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  FileText, 
  Upload, 
  FileCode,
  Eye,
  Type,
  Code,
  Settings2,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Folder
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import JSZip from "jszip"
import { Loader2, FileIcon, Download } from 'lucide-react'


export default function Editor() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [epubFiles, setEpubFiles] = useState<Record<string, { content: string | Uint8Array, type: 'text' | 'binary' }>>({})
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editorMode, setEditorMode] = useState<'code' | 'preview'>('code')
  const [showMetadata, setShowMetadata] = useState(true)
  const [resolvedContent, setResolvedContent] = useState<string>('')
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null)
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null)
  const [opfPath, setOpfPath] = useState<string | null>(null)
  const [metadata, setMetadata] = useState({
    title: '',
    creator: '',
    language: '',
    publisher: '',
    date: '',
    identifier: ''
  })
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      setIsLoading(true)
      setUploadedFile(file)
      
      try {
        const zip = new JSZip()
        const loadedZip = await zip.loadAsync(file)
        setZipInstance(loadedZip)
        
        const files: Record<string, { content: string | Uint8Array, type: 'text' | 'binary' }> = {}
        const filePromises = Object.keys(loadedZip.files).map(async (path) => {
          const zipFile = loadedZip.files[path]
          if (zipFile.dir) return

          const isText = path.endsWith('.xhtml') || path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.opf') || path.endsWith('.ncx') || path.endsWith('.xml')
          
          if (isText) {
            const content = await zipFile.async('text')
            files[path] = { content, type: 'text' }
          } else {
            const content = await zipFile.async('uint8array')
            files[path] = { content, type: 'binary' }
          }
        })

        await Promise.all(filePromises)
        setEpubFiles(files)

        // Find OPF file to extract metadata
        const containerXml = files['META-INF/container.xml']?.content as string
        if (containerXml) {
          const parser = new DOMParser()
          const containerDoc = parser.parseFromString(containerXml, "text/xml")
          const foundOpfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path")
          
          if (foundOpfPath && files[foundOpfPath]) {
            setOpfPath(foundOpfPath)
            const opfContent = files[foundOpfPath].content as string
            const opfDoc = parser.parseFromString(opfContent, "text/xml")
            
            const getMeta = (tag: string) => {
              const el = opfDoc.getElementsByTagName(tag)[0] || opfDoc.getElementsByTagName(`dc:${tag}`)[0]
              return el?.textContent || ""
            }

            setMetadata({
              title: getMeta("title"),
              creator: getMeta("creator"),
              language: getMeta("language"),
              publisher: getMeta("publisher"),
              date: getMeta("date"),
              identifier: getMeta("identifier")
            })
          }
        }

        // Find a default active file
        const defaultFile = Object.keys(files).find(p => p.endsWith('.xhtml')) || Object.keys(files)[0]
        setActiveFile(defaultFile)
      } catch (error) {
        console.error("Error loading EPUB:", error)
      } finally {
        setIsLoading(false)
      }
    }
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      // Reuse file change logic
      const fakeEvent = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileChange(fakeEvent)
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const clearFile = () => {
    setUploadedFile(null)
    setEpubFiles({})
    setActiveFile(null)
    setOpfPath(null)
    setZipInstance(null)
  }

  const handleExport = async () => {
    if (!zipInstance) return
    setIsExporting(true)
    
    try {
      const zip = new JSZip()
      // Add all files back to zip
      Object.entries(epubFiles).forEach(([path, { content }]) => {
        zip.file(path, content)
      })
      
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = uploadedFile?.name || 'exported.epub'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting EPUB:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleContentChange = (content: string) => {
    if (!activeFile) return
    setIsProcessing(true)
    setEpubFiles(prev => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], content }
    }))
    // Brief timeout to show the "processing" state
    setTimeout(() => setIsProcessing(false), 300)
  }

  const resolveImages = async (html: string, currentFilePath: string) => {
    if (!zipInstance) return html
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const images = doc.querySelectorAll('img')
    
    const currentDir = currentFilePath.split('/').slice(0, -1).join('/')
    
    for (const img of images) {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        // Resolve relative path
        let absolutePath = src
        if (src.startsWith('../')) {
           const parts = currentDir.split('/')
           const srcParts = src.split('/')
           while(srcParts[0] === '..') {
             srcParts.shift()
             parts.pop()
           }
           absolutePath = [...parts, ...srcParts].join('/')
        } else if (!src.startsWith('/')) {
           absolutePath = currentDir ? `${currentDir}/${src}` : src
        }
        
        // Clean up path (remove ./ etc)
        absolutePath = absolutePath.replace(/\/\.\//g, '/')
        
        const imageFile = epubFiles[absolutePath] || Object.keys(epubFiles).find(k => k.endsWith(src))
        if (imageFile && imageFile.type === 'binary') {
           const blob = new Blob([imageFile.content as any])
           const base64 = await new Promise<string>((resolve) => {
             const reader = new FileReader()
             reader.onloadend = () => resolve(reader.result as string)
             reader.readAsDataURL(blob)
           })
           img.setAttribute('src', base64)
        }
      }
    }
    
    return doc.documentElement.outerHTML
  }

  useEffect(() => {
    if (editorMode === 'preview' && activeFile) {
      const file = epubFiles[activeFile]
      if (file?.type === 'text') {
        resolveImages(file.content as string, activeFile).then(setResolvedContent)
        setActiveImageSrc(null)
      } else if (file?.type === 'binary') {
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(activeFile)
        if (isImage) {
          const blob = new Blob([file.content as any])
          const reader = new FileReader()
          reader.onloadend = () => setActiveImageSrc(reader.result as string)
          reader.readAsDataURL(blob)
        } else {
          setActiveImageSrc(null)
        }
      } else {
        setActiveImageSrc(null)
      }
    } else {
      setActiveImageSrc(null)
    }
  }, [editorMode, activeFile, epubFiles])

  useEffect(() => {
    const viewer = document.getElementById('viewer')
    if (viewer) {
      const parent = viewer.parentElement
      // remove display:table style
      if (parent) {
        parent.style.height='100%'
      }
    }
  }, [activeFile])

  if (!uploadedFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl text-center space-y-8 relative z-10"
        >
          <div className="space-y-4">
            <Badge variant="outline" className="px-3 py-1 border-primary/20 bg-primary/5 text-primary">
              Pro Editor
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Open an EPUB to <span className="text-primary italic">Refine</span>.
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Inspect chapters, live-edit metadata, and adjust the core OPF structure in a professional distraction-free environment.
            </p>
          </div>

          <div
            className={cn(
              "group relative rounded-[2.5rem] border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-xl p-12 transition-all",
              "hover:border-primary/50 hover:bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".epub,application/epub+zip"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-[2rem] bg-background border shadow-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drop your book here</h3>
              <p className="text-muted-foreground mb-8">Supports standards-based .epub files</p>
              <Button 
                size="lg" 
                className="rounded-2xl px-10 h-14 text-lg shadow-lg shadow-primary/20"
                onClick={() => inputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-card border flex items-center justify-center">
                <FileCode className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Source Edit</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-card border flex items-center justify-center">
                <Type className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Metadata</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-card border flex items-center justify-center">
                <Eye className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <div className="space-y-1 text-center">
                  <h3 className="text-xl font-semibold">Unpacking EPUB...</h3>
                  <p className="text-sm text-muted-foreground animate-pulse">Initializing JSZip and extracting content</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }


  const getCategorizedFiles = () => {
    const folders: Record<string, string[]> = {}
    const coreFiles: string[] = []
    const sectionFiles: Record<string, string[]> = {}

    Object.keys(epubFiles).forEach(path => {
      if (path === 'mimetype') return
      
      if (path === 'META-INF/container.xml') {
        coreFiles.unshift(path)
      } else if (path.startsWith('OEBPS/')) {
        const parts = path.split('/')
        if (parts.length > 2) {
          const subfolder = parts[1]
          if (!sectionFiles[subfolder]) sectionFiles[subfolder] = []
          sectionFiles[subfolder].push(path)
        } else {
          coreFiles.push(path)
        }
      } else if (path.includes('/')) {
        const rootFolder = path.split('/')[0]
        if (!folders[rootFolder]) folders[rootFolder] = []
        folders[rootFolder].push(path)
      } else {
        coreFiles.push(path)
      }
    })

    return { coreFiles, sectionFiles, folders }
  }

  const { coreFiles, sectionFiles, folders } = getCategorizedFiles()

  const handleMetadataChange = (key: keyof typeof metadata, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }))
    
    if (opfPath && epubFiles[opfPath]) {
      const opfContent = epubFiles[opfPath].content as string
      const parser = new DOMParser()
      const opfDoc = parser.parseFromString(opfContent, "text/xml")
      
      const tag = key === 'creator' ? 'creator' : key === 'title' ? 'title' : key === 'language' ? 'language' : key === 'publisher' ? 'publisher' : key === 'date' ? 'date' : 'identifier'
      
      let el = opfDoc.getElementsByTagName(tag)[0] || opfDoc.getElementsByTagName(`dc:${tag}`)[0]
      
      if (!el) {
        // Try creating if it doesn't exist? For now just skip if missing to avoid breaking valid OPF
        return
      }

      el.textContent = value
      const serializer = new XMLSerializer()
      const newOpfContent = serializer.serializeToString(opfDoc)
      
      setEpubFiles(prev => ({
        ...prev,
        [opfPath]: { ...prev[opfPath], content: newOpfContent }
      }))
    }
  }

  return (
    <div className="h-[90vh] flex flex-col bg-background overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/[0.02] blur-[120px] rounded-full pointer-events-none" />

      {/* Editor Toolbar */}
      <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-4 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={clearFile}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close Editor</TooltipContent>
          </Tooltip>
          <div className="h-6 w-px bg-border/50 mx-2" />
          
          {Object.keys(epubFiles).length > 0 && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold truncate max-w-[200px]">{uploadedFile?.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Project Workspace</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={cn(
            "border-none px-3 py-1 flex items-center gap-1.5 transition-colors",
            isProcessing ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
          )}>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            )} />
            {isLoading ? 'Loading...' : isProcessing ? 'Syncing...' : 'File Loaded'}
          </Badge>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
            <Button 
              variant={editorMode === 'code' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg px-3 gap-1.5 text-xs"
              onClick={() => setEditorMode('code')}
            >
              <Code className="h-3.5 w-3.5" />
              Code
            </Button>
            <Button 
              variant={editorMode === 'preview' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 rounded-lg px-3 gap-1.5 text-xs"
              onClick={() => setEditorMode('preview')}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </div>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 rounded-xl"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            {showMetadata ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </Button>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <Button 
            className="rounded-xl h-10 gap-2 shadow-lg shadow-primary/20"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 gap-4 relative z-10">
        {/* Left Sidebar: Structure */}
        <aside className="w-80 border-r border-border/50 bg-card/5 backdrop-blur-sm flex flex-col shrink-0 rounded-r-[2.5rem] overflow-hidden">
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
              <BookOpen className="h-3 w-3" />
              Library Structure
            </h2>
          </div>
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="space-y-8">
              {coreFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-primary/40 uppercase tracking-widest text-nowrap">Core Assets</div>
                  <div className="space-y-1">
                    {coreFiles.map(path => (
                      <div 
                        key={path}
                        onClick={() => setActiveFile(path)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer group transition-all",
                          activeFile === path ? "bg-primary/10 text-primary shadow-sm" : "hover:bg-primary/5 text-muted-foreground"
                        )}
                      >
                        <FileCode className={cn("h-4 w-4", path.endsWith('.xml') ? "text-blue-500" : "text-purple-500")} />
                        <span className="flex-1 font-medium truncate">{path.split('/').pop()}</span>
                        {activeFile === path && <div className="h-1 w-1 rounded-full bg-primary" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.entries(sectionFiles).length > 0 && (
                <div className="space-y-4">
                   <div className="px-3 py-1 text-[10px] font-bold text-primary/40 uppercase tracking-widest">Manuscript Sections</div>
                   {Object.entries(sectionFiles).map(([subfolder, files]) => (
                     <div key={subfolder} className="space-y-1 ml-1">
                        <div 
                          className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-muted-foreground/60 uppercase cursor-pointer hover:text-foreground transition-colors group"
                          onClick={() => setCollapsedFolders(prev => ({ ...prev, [subfolder]: !prev[subfolder] }))}
                        >
                          <Folder className="h-3.5 w-3.5 text-primary/40 group-hover:text-primary/60 transition-colors" />
                          <span className="flex-1">{subfolder}</span>
                          {collapsedFolders[subfolder] ? (
                            <ChevronRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <ChevronDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        {!collapsedFolders[subfolder] && (
                          <div className="space-y-1 border-l border-border/50 ml-4 pl-2 mt-1">
                            {files.map(path => (
                              <div 
                                key={path}
                                onClick={() => setActiveFile(path)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer group transition-all",
                                  activeFile === path ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-primary/5 text-muted-foreground/70"
                                )}
                              >
                                <FileText className={cn("h-4 w-4 shrink-0", activeFile === path ? "text-primary-foreground" : "text-emerald-500/60")} />
                                <span className="flex-1 font-medium truncate">{path.split('/').pop()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                     </div>
                   ))}
                </div>
              )}

              {Object.entries(folders).map(([folder, files]) => (
                <div key={folder} className="space-y-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-primary/40 uppercase tracking-widest">{folder}</div>
                  <div className="space-y-1">
                    {files.map(path => (
                      <div 
                        key={path}
                        onClick={() => setActiveFile(path)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer group transition-all",
                          activeFile === path ? "bg-primary/10 text-primary shadow-sm" : "hover:bg-primary/5 text-muted-foreground"
                        )}
                      >
                        <FileIcon className="h-4 w-4 text-muted-foreground/60" />
                        <span className="flex-1 font-medium truncate">{path.split('/').pop()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Center: Editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col border-border/50 bg-card/10 backdrop-blur-sm overflow-hidden rounded-[2.5rem] shadow-2xl">
            <div className="h-14 px-8 border-b border-border/50 flex items-center justify-between bg-background/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                )} />
                <span className="text-xs font-mono font-medium text-muted-foreground">{activeFile}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="rounded-lg border-border/50 font-mono text-[10px] px-2 py-0.5 opacity-60">UTF-8</Badge>
                {activeFile?.endsWith('.xhtml') && (
                  <Badge variant="outline" className="rounded-lg border-border/50 font-mono text-[10px] px-2 py-0.5 opacity-60">XHTML 1.1</Badge>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1 relative">
              <AnimatePresence>
                {isExporting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[2px] flex items-center justify-center"
                  >
                    <div className="bg-card border shadow-2xl rounded-2xl p-6 flex items-center gap-4">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      <div>
                        <p className="font-semibold">Repackaging EPUB...</p>
                        <p className="text-xs text-muted-foreground">Compressing and finalizing file</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div id='viewer' className="h-full font-mono text-sm leading-relaxed p-0 overflow-hidden">
                {activeFile && epubFiles[activeFile]?.type === 'text' ? (
                  editorMode === 'code' ? (
                    <textarea
                      spellCheck={false}
                      className="w-full h-full min-h-full resize-none border-0 bg-transparent text-foreground outline-none focus-visible:ring-0 leading-relaxed p-10 selection:bg-primary/20"
                      value={epubFiles[activeFile].content as string}
                      onChange={(e) => handleContentChange(e.target.value)}
                    />
                  ) : (
                    <iframe
                      title="Preview"
                      className="w-full h-full border-0 bg-white"
                      srcDoc={resolvedContent || (epubFiles[activeFile].content as string)}
                    />
                  )
                ) : activeFile && epubFiles[activeFile]?.type === 'binary' ? (
                  editorMode === 'preview' && activeImageSrc ? (
                    <div className="flex items-center justify-center h-full p-10 bg-muted/5 backdrop-blur-sm">
                      <div className="relative group">
                        <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <img 
                          src={activeImageSrc} 
                          alt={activeFile} 
                          className="max-w-full max-h-full rounded-2xl shadow-2xl relative z-10 border border-white/10"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5">
                      <div className="h-24 w-24 rounded-3xl bg-background border flex items-center justify-center mb-6 shadow-xl">
                        <FileIcon className="h-10 w-10 opacity-20" />
                      </div>
                      <p className="font-medium">Binary Asset Layer</p>
                      <p className="text-xs opacity-50">{(epubFiles[activeFile].content as Uint8Array).length} bytes • Preview unavailable</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                     <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center">
                        <Code className="h-8 w-8 opacity-20" />
                     </div>
                     <p className="italic text-sm">Synchronizing project tree...</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </main>

        {/* Right Sidebar: Attributes */}
        <AnimatePresence>
          {showMetadata && (
            <motion.aside 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="w-[450px] border-l border-border/50 bg-card/10 backdrop-blur-md flex flex-col shrink-0 rounded-l-[3rem] overflow-hidden shadow-2xl relative z-20"
            >
              <Tabs defaultValue="metadata" className="flex-1 flex flex-col">
                {/* <div className="p-6 border-b border-border/50 bg-background/10">
                  <TabsList className="w-full bg-muted/20 p-1.5 rounded-2xl h-14">
                    <TabsTrigger value="metadata" className="w-full rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg h-full transition-all duration-300">Metadata Engine</TabsTrigger>
                  </TabsList>
                </div> */}
                
                <TabsContent value="metadata" className="flex-1 m-0 p-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-10 space-y-6 pb-24">
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 flex items-center gap-3">
                          <Type className="h-3 w-3" />
                          Core Lexicon
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Book Title</Label>
                            <Input 
                              value={metadata.title} 
                              onChange={(e) => handleMetadataChange('title', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Primary Author</Label>
                            <Input 
                              value={metadata.creator} 
                              onChange={(e) => handleMetadataChange('creator', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Language Code</Label>
                            <Input 
                              value={metadata.language} 
                              onChange={(e) => handleMetadataChange('language', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 flex items-center gap-3">
                          <Settings2 className="h-3 w-3" />
                          Publisher Data
                        </h3>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Publisher</Label>
                            <Input 
                              value={metadata.publisher} 
                              onChange={(e) => handleMetadataChange('publisher', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Date</Label>
                            <Input 
                              value={metadata.date}
                              onChange={(e) => handleMetadataChange('date', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Identifier (ISBN)</Label>
                            <Input 
                              value={metadata.identifier} 
                              onChange={(e) => handleMetadataChange('identifier', e.target.value)}
                              className="h-10 bg-background/50 rounded-xl" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
