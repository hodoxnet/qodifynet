"use client";

import { DeploymentWizard } from "@/components/DeploymentWizard";
import { useRouter } from "next/navigation";

export default function NewWizardPage() {
  const router = useRouter();

  return (
    <div>
      <DeploymentWizard
        onBack={() => router.push("/wizard")}
        onComplete={() => {
          router.push("/customers");
        }}
      />
    </div>
  );
}