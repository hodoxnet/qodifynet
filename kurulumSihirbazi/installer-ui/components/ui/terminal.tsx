"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Terminal as TerminalIcon, Maximize2, Minimize2, Copy, Download, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface TerminalLog {
  id: string;
  content: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'system' | 'progress';
  timestamp: Date;
  metadata?: {
    progress?: number;
    step?: string;
    duration?: number;
  };
}

interface TerminalProps {
  logs: TerminalLog[];
  title?: string;
  showTimestamps?: boolean;
  maxHeight?: string;
  autoScroll?: boolean;
  showSearch?: boolean;
  showLineNumbers?: boolean;
  onClear?: () => void;
  className?: string;
  isLoading?: boolean;
  fullscreenEnabled?: boolean;
}

export function Terminal({
  logs,
  title = "Terminal",
  showTimestamps = true,
  maxHeight = "h-96",
  autoScroll = true,
  showSearch = false,
  showLineNumbers = false,
  onClear,
  className,
  isLoading = false,
  fullscreenEnabled = true
}: TerminalProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearchBar, setShowSearchBar] = React.useState(false);
  const [filteredLogs, setFilteredLogs] = React.useState<TerminalLog[]>(logs);

  // Scroll to bottom fonksiyonu
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  // Logs değiştiğinde auto-scroll
  useEffect(() => {
    if (autoScroll) {
      // Hemen dene
      scrollToBottom();

      // DOM güncellemesi için kısa bir gecikme ile tekrar dene
      const timeoutId = setTimeout(scrollToBottom, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [logs, autoScroll, scrollToBottom]);

  // Arama sonuçlarını filtrele
  useEffect(() => {
    if (searchQuery) {
      const filtered = logs.filter(log =>
        log.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLogs(filtered);
    } else {
      setFilteredLogs(logs);
    }
  }, [searchQuery, logs]);

  const handleCopy = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = showTimestamps ? `[${log.timestamp.toLocaleTimeString()}] ` : '';
      return `${timestamp}${log.content}`;
    }).join('\n');

    navigator.clipboard.writeText(logText);
    toast.success('Loglar panoya kopyalandı');
  };

  const handleDownload = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = `[${log.timestamp.toISOString()}] `;
      return `${timestamp}${log.type.toUpperCase()}: ${log.content}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Loglar indirildi');
  };

  const getLogColor = (type: TerminalLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400';
      case 'error':
        return 'text-rose-400';
      case 'warning':
        return 'text-amber-400';
      case 'system':
        return 'text-blue-400';
      case 'progress':
        return 'text-purple-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLogIcon = (type: TerminalLog['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'system':
        return '⚙';
      case 'progress':
        return '◗';
      default:
        return '›';
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border border-gray-800 bg-gray-950 shadow-2xl",
        isFullscreen && "fixed inset-4 z-50",
        className
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500" />
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center space-x-2">
            <TerminalIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">{title}</span>
            {isLoading && (
              <Badge variant="outline" className="border-gray-700 bg-gray-800 text-gray-300">
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Çalışıyor
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {showSearch && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
              onClick={() => setShowSearchBar(!showSearchBar)}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {onClear && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {fullscreenEnabled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearchBar && (
        <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-2">
          <Input
            type="text"
            placeholder="Loglarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 border-gray-700 bg-gray-800 text-sm text-gray-200 placeholder:text-gray-500"
          />
        </div>
      )}

      {/* Terminal Body */}
      <ScrollArea
        className={cn(
          "w-full bg-gray-950 p-4 font-mono text-xs",
          !isFullscreen && maxHeight
        )}
        ref={scrollAreaRef}
      >
        <div className="space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500">
              {searchQuery ? 'Arama sonucu bulunamadı' : 'Log bulunmuyor'}
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={log.id}
                className="group flex items-start space-x-2 hover:bg-gray-900/30"
              >
                {showLineNumbers && (
                  <span className="select-none text-gray-600">
                    {String(index + 1).padStart(3, '0')}
                  </span>
                )}
                {showTimestamps && (
                  <span className="select-none text-gray-500">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                )}
                <span className={cn("select-none", getLogColor(log.type))}>
                  {getLogIcon(log.type)}
                </span>
                <span className={cn("flex-1 break-words", getLogColor(log.type))}>
                  {log.content}
                  {log.metadata?.progress !== undefined && (
                    <span className="ml-2 text-gray-500">
                      ({log.metadata.progress}%)
                    </span>
                  )}
                  {log.metadata?.duration !== undefined && (
                    <span className="ml-2 text-gray-500">
                      ({log.metadata.duration}ms)
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <span className="inline-block animate-pulse">█</span>
              <span>İşlem devam ediyor...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Terminal Footer */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredLogs.length} log</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}

export type { TerminalLog, TerminalProps };