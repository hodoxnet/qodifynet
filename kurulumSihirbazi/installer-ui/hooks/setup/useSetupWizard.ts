import { useState, useEffect, useCallback } from 'react';
import { SetupConfig, DEFAULT_CONFIG, WizardStep } from '@/lib/types/setup';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export function useSetupWizard() {
  const { user, hasScope } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SYSTEM_CHECK);
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG);

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isPartner = !isStaff && (hasScope('setup.run') || !!user?.partnerId || (user?.role || '').startsWith('PARTNER_'));

  // Partner kullanıcılar için yasak adımlarda otomatik yönlendirme
  useEffect(() => {
    if (isPartner && (currentStep === WizardStep.DATABASE_CONFIG || currentStep === WizardStep.REDIS_CONFIG)) {
      // Partner bu adımlarda olamaz, direkt SITE_CONFIG'e yönlendir
      setCurrentStep(WizardStep.SITE_CONFIG);
    }
  }, [currentStep, isPartner]);

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
      let nextStepValue = (currentStep + 1) as WizardStep;

      // Partner kullanıcılar için DB ve Redis adımlarını atla
      if (isPartner) {
        // SYSTEM_CHECK'ten sonra direkt SITE_CONFIG'e
        if (currentStep === WizardStep.SYSTEM_CHECK) {
          nextStepValue = WizardStep.SITE_CONFIG;
        }
        // DATABASE_CONFIG veya REDIS_CONFIG'te olmamalılar, SITE_CONFIG'e git
        else if (nextStepValue === WizardStep.DATABASE_CONFIG || nextStepValue === WizardStep.REDIS_CONFIG) {
          nextStepValue = WizardStep.SITE_CONFIG;
        }
      }

      setCurrentStep(nextStepValue);
    }
  }, [currentStep, isPartner]);

  const previousStep = useCallback(() => {
    if (currentStep > WizardStep.SYSTEM_CHECK) {
      let prevStepValue = (currentStep - 1) as WizardStep;

      // Partner kullanıcılar için DB ve Redis adımlarını atla
      if (isPartner) {
        // SITE_CONFIG'ten geri giderken direkt SYSTEM_CHECK'e
        if (currentStep === WizardStep.SITE_CONFIG || currentStep === WizardStep.SUMMARY) {
          prevStepValue = currentStep === WizardStep.SITE_CONFIG ? WizardStep.SYSTEM_CHECK : WizardStep.SITE_CONFIG;
        }
        // DATABASE_CONFIG veya REDIS_CONFIG'te olmamalılar
        else if (prevStepValue === WizardStep.DATABASE_CONFIG || prevStepValue === WizardStep.REDIS_CONFIG) {
          prevStepValue = WizardStep.SYSTEM_CHECK;
        }
      }

      setCurrentStep(prevStepValue);
    }
  }, [currentStep, isPartner]);

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
