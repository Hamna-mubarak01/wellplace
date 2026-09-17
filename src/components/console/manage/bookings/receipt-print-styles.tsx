const PRINT_CSS = [
  '[data-slot="sidebar"],[data-slot="sidebar-inset"] header,[data-receipt-hide]{display:none!important}',
  '[data-slot="sidebar-inset"]{margin:0!important}',
  "[data-receipt-document]{border:0!important;box-shadow:none!important}",
].join("");

export function ReceiptPrintStyles() {
  return <style media="print">{PRINT_CSS}</style>;
}
