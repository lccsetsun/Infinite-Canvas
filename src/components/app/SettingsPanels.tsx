import React from "react";
import { motion } from "motion/react";
import { ApiSettings } from "../../features/api/apiSettings";

const ApiSettingsPage = React.lazy(() => import("../pages/ApiSettingsPage"));
const WorkflowSettingsPage = React.lazy(() => import("../pages/WorkflowSettingsPage"));

interface SettingsPanelsProps {
  apiSettings: ApiSettings;
  autoSaveWorkflow: boolean;
  currentView: "canvas" | "api" | "workflow";
  fallback: React.ReactNode;
  workflowName: string;
  onSaveApiSettings: (settings: ApiSettings) => void;
  onSaveWorkflow: () => void;
  setAutoSaveWorkflow: (value: boolean) => void;
  setWorkflowName: (value: string) => void;
  showNotice: (message: string, kind?: "info" | "success" | "warning" | "error") => void;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-y-0 right-0 left-24 z-[100]"
    >
      {children}
    </motion.div>
  );
}

export default function SettingsPanels({
  apiSettings,
  autoSaveWorkflow,
  currentView,
  fallback,
  workflowName,
  onSaveApiSettings,
  onSaveWorkflow,
  setAutoSaveWorkflow,
  setWorkflowName,
  showNotice,
}: SettingsPanelsProps) {
  return (
    <>
      {currentView === "api" && (
        <React.Suspense fallback={fallback}>
          <PageShell>
            <ApiSettingsPage
              initial={apiSettings}
              onSave={onSaveApiSettings}
              showNotice={showNotice}
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
              onSave={onSaveWorkflow}
            />
          </PageShell>
        </React.Suspense>
      )}
    </>
  );
}
