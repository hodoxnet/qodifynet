"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Hooks
import { useSetupWizard } from '@/hooks/setup/useSetupWizard';
import { useInstallation } from '@/hooks/setup/useInstallation';

// Steps
import { SystemCheckStep } from '@/components/setup/steps/SystemCheckStep';
import { DatabaseStep } from '@/components/setup/steps/DatabaseStep';
import { RedisStep } from '@/components/setup/steps/RedisStep';
import { SiteConfigStep } from '@/components/setup/steps/SiteConfigStep';
import { SummaryStep } from '@/components/setup/steps/SummaryStep';
import { InstallationStep } from '@/components/setup/steps/InstallationStep';

// Types
import { WizardStep, STEP_TITLES } from '@/lib/types/setup';

export function SetupWizard() {
  const {
    currentStep,
    config,
    setCurrentStep,
    nextStep,
    previousStep,
    updateConfig
  } = useSetupWizard();

  const {
    installProgress,
    installStatus,
    completedInfo,
    startInstallation
  } = useInstallation();

  const handleStartInstallation = async () => {
    await startInstallation(config);
    setCurrentStep(WizardStep.INSTALLATION);
  };

  const renderStep = () => {
    const stepProps = {
      config,
      onConfigUpdate: updateConfig,
      onNext: nextStep,
      onBack: previousStep
    };

    switch (currentStep) {
      case WizardStep.SYSTEM_CHECK:
        return <SystemCheckStep onNext={nextStep} />;
      case WizardStep.DATABASE_CONFIG:
        return <DatabaseStep {...stepProps} />;
      case WizardStep.REDIS_CONFIG:
        return <RedisStep {...stepProps} />;
      case WizardStep.SITE_CONFIG:
        return <SiteConfigStep {...stepProps} />;
      case WizardStep.SUMMARY:
        return (
          <SummaryStep
            {...stepProps}
            onStartInstallation={handleStartInstallation}
            installStatus={installStatus}
          />
        );
      case WizardStep.INSTALLATION:
        return (
          <InstallationStep
            installStatus={installStatus}
            installProgress={installProgress}
            completedInfo={completedInfo}
            adminEmail={config.adminEmail}
          />
        );
      default:
        return null;
    }
  };

  const progressPercentage = ((currentStep - 1) / (STEP_TITLES.length - 1)) * 100;

  return (
    <>
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          Qodify Kurulum Sihirbazı
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Yeni bir e-ticaret sitesi kurun
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="mb-4">
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Step Labels - Mobile Responsive */}
        <div className="hidden md:flex items-center justify-between">
            {STEP_TITLES.map((title, index) => {
              const stepNumber = index + 1;
              const isActive = currentStep === stepNumber;
              const isCompleted = currentStep > stepNumber;

              return (
                <div
                  key={index}
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-300",
                      isActive && "border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:border-indigo-400 dark:bg-indigo-600 dark:shadow-indigo-900/50",
                      isCompleted && "border-emerald-500 bg-gradient-to-br from-emerald-400 to-emerald-500 text-white dark:from-emerald-500 dark:to-emerald-600",
                      !isActive && !isCompleted && "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                    )}
                  >
                    {isCompleted ? "✓" : stepNumber}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium transition-colors",
                      isActive && "text-indigo-600 dark:text-indigo-400",
                      isCompleted && "text-emerald-600 dark:text-emerald-400",
                      !isActive && !isCompleted && "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {title}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Mobile Step Indicator */}
        <div className="flex items-center justify-center md:hidden">
            <Badge variant="outline" className="px-3 py-1">
              Adım {currentStep} / {STEP_TITLES.length}: {STEP_TITLES[currentStep - 1]}
            </Badge>
        </div>
      </div>

      {/* Step Content with Animation */}
      <div className="w-full">
        <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStep()}
              </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2024 Qodify. Tüm hakları saklıdır.</p>
      </div>
    </>
  );
}