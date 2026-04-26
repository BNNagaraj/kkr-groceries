/**
 * Module augmentation for jsPDF + jspdf-autotable.
 *
 * The `jspdf-autotable` plugin attaches a `lastAutoTable` property to every
 * jsPDF instance after rendering a table. The plugin's bundled type
 * definitions don't include this on the jsPDF interface itself, so without
 * augmentation every `doc.lastAutoTable.finalY` access requires `as any`.
 */
import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}
