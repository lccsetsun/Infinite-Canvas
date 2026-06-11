import React from "react";
import { motion } from "motion/react";

const WorkflowSettingsPage = React.lazy(() => import("../pages/WorkflowSettingsPage"));

interface SettingsPanelsProps {
  autoSaveWorkflow: boolean;
  currentView: "canvas" | "api" | "workflow";
  fallback: React.ReactNode;
  workflowName: string;
  onSaveWorkflow: () => void;
  setAutoSaveWorkflow: (value: boolean) => void;
  setWorkflowName: (value: string) => void;
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
  autoSaveWorkflow,
  currentView,
  fallback,
  workflowName,
  onSaveWorkflow,
  setAutoSaveWorkflow,
  setWorkflowName,
}: SettingsPanelsProps) {
  return (
    <>
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
