"use client";

import {
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from "@codesandbox/sandpack-react";

export default function GameIDE() {
  return (
    <SandpackLayout className="w-full h-full border rounded-lg overflow-hidden">
      <SandpackCodeEditor showTabs closableTabs />
      <SandpackPreview />
    </SandpackLayout>
  );
}