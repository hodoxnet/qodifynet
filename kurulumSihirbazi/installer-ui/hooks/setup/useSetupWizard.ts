import { useState, useEffect, useCallback } from 'react';
import { SetupConfig, DEFAULT_CONFIG, WizardStep } from '@/lib/types/setup';
import { toast } from 'sonner';

export function useSetupWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SYSTEM_CHECK);
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG);

  // Domain'e göre otomatik DB adı öner
  useEffect(() => {
    if (config.domain) {
      const dbName = `qodify_${config.domain.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      setConfig(prev => ({ ...prev, dbName }));
    }
  }, [config.domain]);

  // Token kontrolü
  useEffect(() => {
    if (currentStep === WizardStep.SYSTEM_CHECK) {
      const token = localStorage.getItem("qid_access");
      if (!token) {
        toast.error("Oturum açmanız gerekiyor!");
        window.location.href = "/login";
      }
    }
  }, [currentStep]);

  const nextStep = useCallback(() => {
    if (currentStep < WizardStep.INSTALLATION) {
      setCurrentStep(prev => (prev + 1) as WizardStep);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    if (currentStep > WizardStep.SYSTEM_CHECK) {
      setCurrentStep(prev => (prev - 1) as WizardStep);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const updateConfig = useCallback((updates: Partial<SetupConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    currentStep,
    config,
    setCurrentStep,
    nextStep,
    previousStep,
    goToStep,
    updateConfig
  };
}