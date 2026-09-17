"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCatalogue } from "@/app/(console)/manage/pricing/actions";
import { AddonCard } from "@/components/booking/addon-card";
import { CmsMediaPicker } from "@/components/console/cms/cms-media-picker";
import { Button } from "@/components/shared/button";
import { ActionError } from "@/components/shared/action-error";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { parseAed, toAedInput } from "@/components/shared/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { CATALOGUE, addonEditorSchema, catalogueInputError, type EditableAddon } from "@/lib/config/catalogue";
import { ADDON_KIND_LABEL } from "@/lib/config/addons";
import { toast } from "@/lib/console/feedback";
import { buildCart } from "@/lib/domain/vouchers";

type NumericKey = "regular_price_fils" | "offer_price_fils" | "min_quantity" | "default_quantity" | "max_quantity" | "inventory" | "sort_order" | "eligible_min_guests" | "eligible_max_guests" | "eligible_min_hours" | "eligible_max_hours";
const SECTIONS = { details: ["name", "description", "image_path", "kind"], pricing: ["regular_price_fils", "offer_price_fils", "saving_label", "default_quantity", "min_quantity", "max_quantity", "is_locked", "is_taxable"] } as const;

export function AddonEditor({ initial, onClose }: { initial: EditableAddon; onClose: () => void }) {
  const [values, setValues] = useState(initial);
  const [section, setSection] = useState("details");
  const [error, setError] = useState<string>();
  const [invalid, setInvalid] = useState<string>();
  const [pending, start] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const router = useRouter();
  const prefix = useId();
  function update<K extends keyof EditableAddon>(key: K, value: EditableAddon[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setError(undefined); setInvalid(undefined);
  }
  const text = (key: "name" | "description" | "saving_label" | "reception_note", label: string, multiline = false) => {
    const props = { id: `${prefix}-${key}`, value: values[key] ?? "", maxLength: key === "name" ? CATALOGUE.maxName : CATALOGUE.maxText, "aria-invalid": invalid === key || undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, event.target.value) };
    return <Field data-invalid={invalid === key || undefined}><FieldLabel htmlFor={props.id}>{label}</FieldLabel>{multiline ? <Textarea {...props} rows={3} className="resize-none" /> : <Input {...props} />}</Field>;
  };
  const number = (key: NumericKey, label: string, optional = false) => <AddonNumberField key={key} id={`${prefix}-${key}`} label={label} initial={values[key]} amount={key.includes("fils")} optional={optional} invalid={invalid === key} onChange={(value) => update(key, value as never)} />;
  const toggle = (key: "is_active" | "is_taxable" | "is_locked", label: string) => <div className="flex min-h-tap items-center justify-between gap-3"><label htmlFor={`${prefix}-${key}`} className="text-console-body">{label}</label><ConsoleSwitch id={`${prefix}-${key}`} checked={values[key]} onCheckedChange={(value) => update(key, value)} /></div>;
  const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const stockMax = Math.min(finite(values.max_quantity), values.inventory ?? CATALOGUE.maxInteger);
  const preview = { id: initial.id ?? "preview", name: values.name.trim() || "Add-on name", description: values.description, imagePath: values.image_path, savingLabel: values.saving_label, kind: values.kind,
    regularUnitPriceFils: finite(values.regular_price_fils), offerUnitPriceFils: finite(values.offer_price_fils), minQuantity: finite(values.min_quantity), maxQuantity: stockMax,
    defaultQuantity: Math.min(finite(values.default_quantity), stockMax), isLocked: values.is_locked, isSoldOut: stockMax < values.min_quantity, isTaxable: values.is_taxable };
  const cart = buildCart([preview], quantities, null);
  function save() {
    const parsed = addonEditorSchema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0], key = String(issue.path[0] ?? "");
      const message = catalogueInputError(issue);setInvalid(key);setError(message);
      const tab = Object.entries(SECTIONS).find(([, keys]) => (keys as readonly string[]).includes(key));if (tab) setSection(tab[0]);
      toast.error("Check this add-on", { description: message });return;
    }
    start(async () => {
      try {
        const result = await saveCatalogue({ kind: "addon", values: parsed.data, expected: initial.id ? initial : null });
        if (!result.ok) { setError(result.message);toast.error("Add-on not saved", { description: result.message });return; }
        toast.success("Add-on saved");router.refresh();onClose();
      } catch { const message = "Your changes could not be saved. Please try again.";setError(message);toast.error(message); }
    });
  }
  return <Sheet open onOpenChange={(open) => { if (!open && !pending) onClose(); }}><SheetContent className="density-console w-full! gap-0 bg-surface-raised sm:max-w-5xl!" onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
    <SheetHeader className="border-b border-border p-5 pr-16"><SheetTitle>{initial.id ? "Edit add-on" : "New add-on"}</SheetTitle><SheetDescription>Changes apply to new bookings.</SheetDescription></SheetHeader>
    <form noValidate onSubmit={(event) => { event.preventDefault();save(); }} className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={pending} className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="grid min-w-0 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-4">{toggle("is_active", "Available for new bookings")}{error && <ActionError message={error} />}
          <Tabs value={section} onValueChange={setSection} className="min-w-0 gap-5"><TabsList className="grid min-h-control w-full grid-cols-2 group-data-horizontal/tabs:h-auto"><TabsTrigger className="min-h-tap" value="details">Details</TabsTrigger><TabsTrigger className="min-h-tap" value="pricing">Price & quantity</TabsTrigger></TabsList>
            <TabsContent value="details" forceMount hidden={section !== "details"} className="space-y-5">
              {text("name", "Name")}{text("description", "Short description", true)}
              <CmsMediaPicker slug="book" label="Photo" url={values.image_path ?? ""} onUploaded={({ url }) => update("image_path", url)} onClear={() => update("image_path", null)} />
              <Field><FieldLabel htmlFor={`${prefix}-kind`}>Item type</FieldLabel><Select value={values.kind} onValueChange={(value) => update("kind", value as EditableAddon["kind"])}><SelectTrigger id={`${prefix}-kind`} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{CATALOGUE.kinds.map((kind) => <SelectItem key={kind} value={kind}>{ADDON_KIND_LABEL[kind]}</SelectItem>)}</SelectContent></Select></Field>
            </TabsContent>
            <TabsContent value="pricing" forceMount hidden={section !== "pricing"} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">{number("regular_price_fils", "Regular price (AED)")}{number("offer_price_fils", "Offer price (AED)")}</div>
              <p className="rounded-(--radius-control) bg-surface-sunken p-3 text-fine">{values.offer_price_fils === 0 ? "Included automatically. No saving percentage is displayed." : "Optional extra. Guests add it with one click."}</p>
              {values.offer_price_fils !== 0 && text("saving_label", "Saving label (optional)")}
              {toggle("is_taxable", "VAT applies — prices include VAT")}
              <div className="grid gap-4 sm:grid-cols-3">{number("min_quantity", "Minimum")}{number("default_quantity", "Default")}{number("max_quantity", "Maximum")}</div>
              {toggle("is_locked", "Prevent removal when included")}
              <p className="text-fine text-text-secondary">Guests can adjust quantities within these limits. Guest count never changes them.</p>
              <Button asChild variant="outline"><Link href="/manage/coupons">Manage add-on coupons</Link></Button>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="min-w-0 space-y-3"><p className="text-console-body font-medium">Guest preview</p><ul><AddonCard addon={preview} line={cart[0] ?? null} onQuantityChange={(id, quantity) => setQuantities((current) => ({ ...current, [id]: quantity }))} /></ul><p className="text-fine text-text-secondary">{values.is_active ? "Visible to guests while it is available for new bookings." : "Hidden from guests until activated."}</p></aside>
      </div></fieldset>
      <SheetFooter className="grid shrink-0 grid-cols-2 gap-3 border-t border-border p-5 sm:flex sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save add-on"}</Button></SheetFooter>
    </form>
  </SheetContent></Sheet>;
}

function AddonNumberField({ id, label, initial, amount, optional, invalid, onChange }: { id: string; label: string; initial: number | null; amount: boolean; optional: boolean; invalid: boolean; onChange: (value: number | null) => void }) {
  const [draft, setDraft] = useState(initial === null ? "" : amount ? toAedInput(initial) : String(initial));
  return <Field data-invalid={invalid || undefined}><FieldLabel htmlFor={id}>{label}{optional && <span className="text-text-muted"> (optional)</span>}</FieldLabel><Input id={id} type="text" inputMode={amount ? "decimal" : "numeric"} autoComplete="off" aria-invalid={invalid || undefined} value={draft} onChange={(event) => {
    const value = event.target.value;setDraft(value);
    onChange(value.trim() === "" && optional ? null : amount ? parseAed(value) ?? NaN : /^\d+$/.test(value) ? Number(value) : NaN);
  }} /></Field>;
}
