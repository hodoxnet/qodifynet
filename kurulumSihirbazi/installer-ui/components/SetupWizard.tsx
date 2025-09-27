"use client";

import { motion, AnimatePresence } from 'framer-motion';

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
import { WizardStep } from '@/lib/types/setup';

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
    steps,
    buildLogs,
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
            steps={steps}
            buildLogs={buildLogs}
          />
        );
      default:
        return null;
    }
  };

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
