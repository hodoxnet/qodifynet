"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Package,
  Database,
  Settings,
  Zap,
  Shield,
  Server,
  Terminal,
  GitBranch
} from 'lucide-react';

interface BuildStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  progress?: number;
  duration?: number;
  message?: string;
  details?: string[];
  icon?: React.ReactNode;
}

interface BuildProgressProps {
  steps: BuildStep[];
  title?: string;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

const defaultIcons: Record<string, React.ReactNode> = {
  'prepareGit': <GitBranch className="h-4 w-4" />,
  'createDatabase': <Database className="h-4 w-4" />,
  'configureEnvironment': <Settings className="h-4 w-4" />,
  'installDependencies': <Package className="h-4 w-4" />,
  'runMigrations': <Database className="h-4 w-4" />,
  'buildApplications': <Terminal className="h-4 w-4" />,
  'configureServices': <Server className="h-4 w-4" />,
  'finalize': <Shield className="h-4 w-4" />
};

export function BuildProgress({
  steps,
  title = "Kurulum İlerlemesi",
  className,
  showDetails = true,
  compact = false
}: BuildProgressProps) {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const overallProgress = (completedSteps / totalSteps) * 100;
  const activeStep = steps.find(s => s.status === 'running');

  const getStatusIcon = (status: BuildStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-rose-500" />;
      case 'skipped':
        return <div className="h-2 w-2 rounded-full bg-gray-400" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />;
    }
  };

  const getStatusColor = (status: BuildStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'error':
        return 'text-rose-600 dark:text-rose-400';
      case 'skipped':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-gray-400 dark:text-gray-500';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (compact) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {completedSteps}/{totalSteps} Tamamlandı
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-2" />
          {activeStep && (
            <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{activeStep.name}</span>
              {activeStep.progress !== undefined && (
                <span className="text-gray-500">({activeStep.progress}%)</span>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {activeStep && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {activeStep.name} işleniyor...
              </p>
            )}
          </div>
          <div className="text-right">
            <Badge variant="outline" className="mb-1">
              {completedSteps}/{totalSteps}
            </Badge>
            <div className="text-xs text-gray-500">
              %{Math.round(overallProgress)} Tamamlandı
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <Progress value={overallProgress} className="h-2" />

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "rounded-lg border p-3 transition-all",
                step.status === 'running' && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20",
                step.status === 'completed' && "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20",
                step.status === 'error' && "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/20",
                (step.status === 'pending' || step.status === 'skipped') && "border-gray-200 dark:border-gray-700"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {/* Step Icon */}
                  <div className="mt-0.5">
                    {getStatusIcon(step.status)}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={cn("flex items-center space-x-1.5", getStatusColor(step.status))}>
                        {step.icon || defaultIcons[step.id] || <Zap className="h-3.5 w-3.5" />}
                        <span className="font-medium">{step.name}</span>
                      </span>
                    </div>

                    {step.message && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {step.message}
                      </p>
                    )}

                    {step.status === 'running' && step.progress !== undefined && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>İlerleme</span>
                          <span>{step.progress}%</span>
                        </div>
                        <Progress value={step.progress} className="h-1.5" />
                      </div>
                    )}

                    {showDetails && step.details && step.details.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {step.details.map((detail, i) => (
                          <div key={i} className="flex items-start space-x-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>•</span>
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration Badge */}
                {step.duration && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    <Clock className="mr-1 h-3 w-3" />
                    {formatDuration(step.duration)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Summary */}
        {steps.some(s => s.status === 'error') && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/20">
            <div className="flex items-start space-x-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-900 dark:text-rose-200">
                  Kurulum Hatası
                </p>
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                  Bir veya daha fazla adımda hata oluştu. Lütfen logları kontrol edin.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export type { BuildStep, BuildProgressProps };
