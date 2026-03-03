import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Trash2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'

import api from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'

export type TranslationStatus = 'queued' | 'in-progress' | 'completed' | 'failed' | 'compiling'

export type TranslationJob = {
  id: string;
  title: string;
  size: number;
  translateTo: string;
  status: TranslationStatus;
  userID: string;
  chunkCount: number;
  objectKey: string;
  createdAt: string;
  updatedAt: string;
}

interface BookCardProps {
  book: TranslationJob;
  onDelete: (id: string) => Promise<void>;
}

export function BookCard({ book: initialBook, onDelete }: BookCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { progress, status } = useSSE(initialBook.id, initialBook.status)
  const book = { ...initialBook, status } as TranslationJob

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const response = await api.get(`/download/${book.id}`)
      const downloadUrl = response.data.url || response.data.URL
      
      if (downloadUrl) {
        // Create a temporary link and click it to trigger the download
        const link = document.createElement('a')
        link.href = downloadUrl
        link.setAttribute('download', `${book.title}.epub`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        console.error('Download URL not found in response', response.data)
      }
    } catch (error) {
      console.error('Error downloading book:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  // SSE logic will be added here later

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
      }}
      layout
    >
      <Card className="group h-full flex flex-col border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                {book.title}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="px-1.5 py-0 rounded text-[10px]">
                  {book.translateTo.toUpperCase()}
                </Badge>
                <span>•</span>
                <span>{formatFileSize(book.size)}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mr-2 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 transition-opacity"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDeleting(true)
                try {
                  await onDelete(book.id)
                } finally {
                  setIsDeleting(false)
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-4 flex-1 flex flex-col">
          <div className="mt-auto space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-4">
                <span className={cn(
                  "font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5",
                  book.status === 'completed' ? "text-emerald-500 bg-emerald-500/10" :
                  book.status === 'failed' ? "text-destructive bg-destructive/10" :
                  "text-blue-500 bg-blue-500/10"
                )}>
                  {book.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : 
                   book.status === 'failed' ? <AlertCircle className="h-3 w-3" /> :
                   <Loader2 className="h-3 w-3 animate-spin" />}
                  {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-help hover:text-foreground transition-colors">
                      {formatRelativeTime(book.createdAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-medium">{new Date(book.createdAt).toLocaleString()}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {book.status !== 'completed' && book.status !== 'failed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full cursor-help">
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-medium">{progress}% Completed</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            <div className="flex gap-2">
              {book.status === 'completed' && (
                <Button 
                  className="flex-1 rounded-lg gap-2" 
                  variant="default" 
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {isDownloading ? 'Downloading...' : 'Download'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
