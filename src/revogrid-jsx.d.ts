import React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "revo-grid": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        columns?: any[];
        source?: any[];
        editable?: boolean;
        resizable?: boolean;
        range?: boolean;
      };
    }
  }
}
export {};
