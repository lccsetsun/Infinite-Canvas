import React from "react";
import { motion } from "motion/react";

const ApiSettingsPage = React.lazy(() => import("../pages/ApiSettingsPage"));
const WorkflowSettingsPage = React.lazy(() => import("../pages/WorkflowSettingsPage"));

interface SettingsPanelsProps {
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  autoSaveWorkflow: boolean;
  currentView: "canvas" | "api" | "workflow";
  fallback: React.ReactNode;
  workflowName: string;
  onBack: () => void;
  onSaveApi: () => void;
  onSaveWorkflow: () => void;
  setApiBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setApiModel: (value: string) => void;
  setAutoSaveWorkflow: (value: boolean) => void;
  setWorkflowName: (value: string) => void;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 z-[100]"
    >
      {children}
    </motion.div>
  );
}

export default function SettingsPanels({
  apiBaseUrl,
  apiKey,
  apiModel,
  autoSaveWorkflow,
  currentView,
  fallback,
  workflowName,
  onBack,
  onSaveApi,
  onSaveWorkflow,
  setApiBaseUrl,
  setApiKey,
  setApiModel,
  setAutoSaveWorkflow,
  setWorkflowName,
}: SettingsPanelsProps) {
  return (
    <>
      {currentView === "api" && (
        <React.Suspense fallback={fallback}>
          <PageShell>
            <ApiSettingsPage
              apiBaseUrl={apiBaseUrl}
              apiKey={apiKey}
              apiModel={apiModel}
              setApiBaseUrl={setApiBaseUrl}
              setApiKey={setApiKey}
              setApiModel={setApiModel}
              onBack={onBack}
              onSave={onSaveApi}
            />
          </PageShell>
        </React.Suspense>
      )}

      {currentView === "workflow" && (
        <React.Suspense fallback={fallback}>
          <PageShell>
            <WorkflowSettingsPage
              workflowName={workflowName}
              autoSaveWorkflow={autoSaveWorkflow}
              setWorkflowName={setWorkflowName}
              setAutoSaveWorkflow={setAutoSaveWorkflow}
              onBack={onBack}
              onSave={onSaveWorkflow}
            />
          </PageShell>
        </React.Suspense>
      )}
    </>
  );
}
