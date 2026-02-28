import { useRef, useState } from 'react'
import { BookOpen, Code2, FileText, ListTree, Upload, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function Editor() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
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
      <div className="flex h-full flex-col bg-background">
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-6 text-center">
            <Badge variant="outline" className="bg-background/70">
              Editor
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Upload an EPUB to edit
            </h1>
            <p className="text-sm text-muted-foreground">
              Drop your EPUB here or choose a file. You can then edit chapters, metadata,
              <span className="font-medium text-foreground"> content.opf</span>, and
              <span className="font-medium text-foreground"> toc.ncx</span> in one place.
            </p>
            <div
              className={cn(
                'rounded-xl border-2 border-dashed bg-muted/30 px-6 py-12 transition-colors',
                'hover:border-primary/50 hover:bg-muted/50',
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
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">Drag and drop your EPUB</p>
              <p className="mt-1 text-xs text-muted-foreground">or</p>
              <Button
                type="button"
                className="mt-3"
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-28 py-6 md:py-8">
          <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1.5">
              <Badge variant="outline" className="bg-background/70">
                Editor
              </Badge>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                {fileName}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                Inspect and adjust chapters, metadata, and core EPUB files like
                <span className="font-medium text-foreground"> content.opf</span> and
                <span className="font-medium text-foreground"> toc.ncx</span> from a single view.
              </p>
            </div>
            <div className="flex w-full max-w-sm items-center gap-2">
              <Button type="button" size="sm" variant="outline">
                Save draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={clearFile}
              >
                <X className="h-3.5 w-3.5" />
                Remove EPUB
              </Button>
            </div>
          </div>

          <section className="mt-6 grid min-h-0 flex-1 gap-4 md:grid-cols-[260px_minmax(0,1.7fr)_minmax(0,1.2fr)]">
            <Card className="flex min-h-0 flex-col border bg-card/90 backdrop-blur">
              <CardHeader className="shrink-0 space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4" />
                  Structure
                </CardTitle>
                <CardDescription>Navigate chapters and core files.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto text-xs text-muted-foreground">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Spine
                  </div>
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-[13px]">
                      <span>01 — Front matter</span>
                    </li>
                    <li className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted/60">
                      <span>02 — Chapter one</span>
                    </li>
                    <li className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted/60">
                      <span>03 — Chapter two</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-1.5 pt-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Core files
                  </div>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted/60">
                      <FileText className="h-3.5 w-3.5" />
                      <span>content.opf</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted/60">
                      <ListTree className="h-3.5 w-3.5" />
                      <span>toc.ncx</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col border bg-card/95 backdrop-blur">
              <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Editor</CardTitle>
                  <CardDescription>Raw XHTML / XML contents for the selected file.</CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1.5 text-[11px]">
                  <Code2 className="h-3.5 w-3.5" />
                  Source view
                </Badge>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 flex flex-col p-3">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-background p-3">
                  <textarea
                    spellCheck={false}
                    className="min-h-0 flex-1 w-full resize-none border-0 bg-transparent font-mono text-[12px] leading-relaxed text-foreground outline-none focus-visible:ring-0"
                    placeholder={`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Chapter one</title>
  </head>
  <body>
    <h1>Chapter one</h1>
    <p>Paste or edit the raw chapter markup here.</p>
  </body>
</html>`}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex min-h-0 flex-col gap-4 overflow-auto">
              <Card className="shrink-0 border bg-card/90 backdrop-blur">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-sm">Metadata</CardTitle>
                  <CardDescription>Key fields from content.opf.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                      Title
                    </div>
                    <Input size={12} className="h-8 text-xs" defaultValue="Reading in Translation" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                      Author
                    </div>
                    <Input size={12} className="h-8 text-xs" defaultValue="Lina Zhou" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                      Language
                    </div>
                    <Input size={12} className="h-8 text-xs" defaultValue="de" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shrink-0 border bg-card/90 backdrop-blur">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-sm">Table of contents</CardTitle>
                  <CardDescription>High-level view from toc.ncx.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5 text-[13px]">
                      <span>Front matter</span>
                      <span className="text-[11px] text-muted-foreground">navPoint 1</span>
                    </li>
                    <li className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted/60">
                      <span>Chapter one</span>
                      <span className="text-[11px] text-muted-foreground">navPoint 2</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

