import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowLeft,
  BookOpen, 
  FileText, 
  ListTree, 
  Upload, 
  Save, 
  FileCode,
  Eye,
  Type
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function Editor() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [activeFile, setActiveFile] = useState<string>('chapter1.xhtml')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      setUploadedFile(file)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      setUploadedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const clearFile = () => setUploadedFile(null)
  const fileName = uploadedFile?.name ?? 'demo.epub'

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
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Editor Toolbar */}
      <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={clearFile}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close Editor</TooltipContent>
          </Tooltip>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold truncate max-w-[200px]">{fileName}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Project Workspace</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none px-3 py-1 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            File Loaded
          </Badge>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <Button variant="outline" className="rounded-xl h-10 gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button className="rounded-xl h-10 gap-2 shadow-lg shadow-primary/20">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Structure */}
        <aside className="w-80 border-r border-border/50 bg-card/20 backdrop-blur-sm flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-3 w-3" />
              Library Structure
            </h2>
            {/* <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Button> */}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-6">
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Core Assets</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-primary/5 cursor-pointer group transition-colors">
                    <FileCode className="h-4 w-4 text-blue-500" />
                    <span className="flex-1 font-medium">content.opf</span>
                    {/* <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /> */}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-primary/5 cursor-pointer group transition-colors">
                    <ListTree className="h-4 w-4 text-purple-500" />
                    <span className="flex-1 font-medium">toc.ncx</span>
                    {/* <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /> */}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">XHTML Chapters</div>
                <div className="space-y-0.5">
                  {[1, 2, 3, 4, 5].map((idx) => {
                    const name = `chapter${idx}.xhtml`
                    const isActive = activeFile === name
                    return (
                      <div 
                        key={idx}
                        onClick={() => setActiveFile(name)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer group transition-all",
                          isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-primary/5"
                        )}
                      >
                        <FileText className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-emerald-500")} />
                        <span className="flex-1 font-medium">Chapter {idx}</span>
                        {/* {isActive && <div className="h-1 w-1 rounded-full bg-primary-foreground" />} */}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Center: Editor */}
        <main className="flex-1 flex flex-col bg-background p-4 overflow-hidden">
          <Card className="flex-1 flex flex-col border-border/50 bg-card/30 overflow-hidden rounded-[2rem]">
            <div className="h-12 px-6 border-b border-border/50 flex items-center justify-between bg-background/50">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs font-mono font-medium text-muted-foreground">{activeFile}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="rounded-md border-border/50 font-mono text-[10px]">UTF-8</Badge>
                <Badge variant="outline" className="rounded-md border-border/50 font-mono text-[10px]">XHTML 1.1</Badge>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 font-mono text-sm leading-relaxed">
                <textarea
                  spellCheck={false}
                  className="w-full min-h-[500px] resize-none border-0 bg-transparent text-foreground outline-none focus-visible:ring-0 leading-relaxed"
                  defaultValue={`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Chapter One</title>
    <link rel="stylesheet" type="text/css" href="../Styles/style.css" />
  </head>
  <body>
    <h1>Chapter One: The Awakening</h1>
    <p>The dawn broke over the horizon, casting long, dramatic shadows across the valley.</p>
    <p>Everything was about to change. The data stream hummed with a rhythm only the initiates could hear.</p>
    <div className="scene-break">***</div>
    <p>It was a cold morning, even for Antarctica.</p>
  </body>
</html>`}
                />
              </div>
            </ScrollArea>
          </Card>
        </main>

        {/* Right Sidebar: Attributes */}
        <aside className="w-96 border-l border-border/50 bg-card/20 backdrop-blur-sm flex flex-col shrink-0">
          <Tabs defaultValue="metadata" className="flex-1 flex flex-col">
            <div className="p-1 border-b border-border/50 bg-background/30">
              <TabsList className="w-full bg-transparent p-0">
                <TabsTrigger value="metadata" className="w-full rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">Metadata</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="metadata" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Core Metadata</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Book Title</Label>
                        <Input defaultValue="Reading in Translation" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Primary Author</Label>
                        <Input defaultValue="Lina Zhou" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Language Code</Label>
                        <Input defaultValue="de-DE" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Publisher Data</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Publisher</Label>
                        <Input defaultValue="NightSky Press" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Date</Label>
                        <Input type="date" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Identifier (ISBN)</Label>
                        <Input defaultValue="978-3-16-148410-0" className="h-10 bg-background/50 rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}
