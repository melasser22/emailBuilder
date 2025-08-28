// index.tsx
import React from "react";
import TemplatePanelJs from "./index.js";

// Optional flag if you ever want to switch to a disabled/test mode
const DISABLE_TSX_WRAPPER = false;

export default function TemplatePanel() {
  if (DISABLE_TSX_WRAPPER) {
    return (
      <div
        style={{
          padding: 20,
          background: "#e6ffed",
          border: "2px solid green",
          borderRadius: 6,
          fontFamily: "monospace",
        }}
      >
        ✅ TSX wrapper is in <strong>safe disabled mode</strong> <br />
        (set <code>DISABLE_TSX_WRAPPER=false</code> to render the real builder)
      </div>
    );
  }

  // Forward to the real builder implementation in index.js
  return <TemplatePanelJs />;
}
