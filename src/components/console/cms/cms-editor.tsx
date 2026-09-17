"use client";

import { NETWORK_MESSAGE } from "@/lib/console/run-action";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  RotateCcwIcon,
  SaveIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "@/lib/console/feedback";

import {
  publishCmsPageAction,
  resetCmsPageAction,
  saveCmsPageDraft,
} from "@/app/(console)/manage/cms/actions";
import {
  CmsImageInput,
  CmsLinesInput,
  CmsMediaInput,
  CmsIconInput,
  CmsListInput,
  CmsRepeaterInput,
  CmsSelectInput,
  CmsTextInput,
  CmsToggleInput,
} from "@/components/console/cms/cms-fields";
import { CmsIcon } from "@/components/console/cms/cms-icon";
import { CmsResetDialog } from "@/components/console/cms/cms-reset-dialog";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  CmsFieldValue,
  CmsMediaItem,
  CmsPageSpec,
  CmsPageValues,
  CmsRepeaterItem,
} from "@/lib/config/cms/types";
import { isSectionCustomised } from "@/lib/config/cms/values";
import { SITE_ICON } from "@/lib/config/site-icon";
import { cn } from "@/lib/utils";

export interface CmsEditorProps {
  page: CmsPageSpec;
  initialValues: CmsPageValues;
  publishedValues: CmsPageValues;
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
}

type Mutable = Record<string, Record<string, CmsFieldValue>>;

export function CmsEditor({
  page,
  initialValues,
  publishedValues,
  status,
  hasUnpublishedChanges,
}: CmsEditorProps) {
  const [values, setValues] = useState<Mutable>(() => structuredClone(initialValues) as Mutable);
  const [saved, setSaved] = useState<Mutable>(() => structuredClone(initialValues) as Mutable);
  const [live, setLive] = useState<Mutable>(() => structuredClone(publishedValues) as Mutable);
  const [publishedPending, setPublishedPending] = useState(hasUnpublishedChanges);
  const [isPending, startTransition] = useTransition();
  const [section, setSection] = useState(page.sections[0]?.key ?? "");

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved],
  );

  function sectionHasUnpublished(sectionKey: string): boolean {
    const section = page.sections.find((entry) => entry.key === sectionKey);
    if (!section) return false;
    return section.fields.some(
      (field) =>
        JSON.stringify(values[sectionKey]?.[field.key]) !==
        JSON.stringify(live[sectionKey]?.[field.key]),
    );
  }

  function setField(sectionKey: string, fieldKey: string, next: CmsFieldValue) {
    setValues((current) => ({
      ...current,
      [sectionKey]: { ...current[sectionKey], [fieldKey]: next },
    }));
  }

  function resetField(sectionKey: string, fieldKey: string) {
    const published = live[sectionKey]?.[fieldKey];
    if (published === undefined) return;
    setField(sectionKey, fieldKey, published);
  }

  function handleSave() {
    startTransition(async () => {
      try {
      const result = await saveCmsPageDraft(page.slug, values);
      if (result.ok) {
        setSaved(structuredClone(values));
        setPublishedPending(true);
        toast.success("Draft saved", {
          description: "Publish when you are ready for it to go live.",
        });
      } else {
        toast.error("Could not save", { description: result.message });
      }
    
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
      if (dirty || status === "draft") {
        const save = await saveCmsPageDraft(page.slug, values);
        if (!save.ok) {
          toast.error("Could not save", { description: save.message });
          return;
        }
        setSaved(structuredClone(values));
      }

      const result = await publishCmsPageAction(page.slug, null);
      if (result.ok) {
        setLive(structuredClone(values));
        setPublishedPending(false);
        if (page.slug === "navbar") window.dispatchEvent(new Event(SITE_ICON.publishedEvent));
        toast.success("Published", { description: "The page is live." });
      } else {
        toast.error("Could not publish", { description: result.message });
      }
    
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      try {
      const result = await resetCmsPageAction(page.slug);
      if (result.ok) {
        const defaults = Object.fromEntries(
          page.sections.map((entry) => [
            entry.key,
            Object.fromEntries(entry.fields.map((field) => [field.key, field.defaultValue])),
          ]),
        ) as Mutable;
        setValues(defaults);
        setSaved(defaults);
        setPublishedPending(true);
        toast.success("Reset to default", {
          description: "Publish to put the built-in content live.",
        });
      } else {
        toast.error("Could not reset", { description: result.message });
      }
    
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    });
  }

  function handleSectionReset(sectionKey: string) {
    const entry = page.sections.find((candidate) => candidate.key === sectionKey);
    if (!entry) return;

    const defaults = structuredClone(
      Object.fromEntries(
        entry.fields.map((field) => [field.key, field.defaultValue]),
      ),
    ) as Record<string, CmsFieldValue>;
    const nextSaved = { ...saved, [sectionKey]: defaults };

    startTransition(async () => {
      try {
      const result = await saveCmsPageDraft(page.slug, nextSaved);
      if (result.ok) {
        setValues((current) => ({ ...current, [sectionKey]: defaults }));
        setSaved(nextSaved);
        setPublishedPending(true);
        toast.success("Section reset to default", {
          description: "Publish when you are ready for it to go live.",
        });
      } else {
        toast.error("Could not reset section", { description: result.message });
      }
    
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    });
  }

  const liveStatus = publishedPending || status === "draft" ? "draft" : "published";
  const previewLabel = (
    <span className="grid">
      <span className={cn("col-start-1 row-start-1", dirty && "invisible")}>Preview draft</span>
      <span className={cn("col-start-1 row-start-1", !dirty && "invisible")}>Save draft to preview</span>
    </span>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="@container min-w-0 flex flex-col gap-5">
        <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 @5xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/manage/cms">
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
                Back
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex min-h-tap flex-wrap items-center gap-2.5">
                <h1 className="min-w-0 wrap-break-word text-console-title font-medium text-text-primary">
                  {page.label}
                </h1>
                <Badge
                  variant={liveStatus === "published" ? "default" : "secondary"}
                  className="gap-1.5"
                >
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                  {liveStatus === "published" ? "Published" : "Draft"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 items-stretch gap-2 [&>.wellplace-button]:h-auto [&>.wellplace-button]:min-h-tap [&>.wellplace-button]:whitespace-normal [&>.wellplace-button]:py-2 [&>:last-child:nth-child(odd)]:col-span-2 @3xl:flex @3xl:flex-wrap @3xl:items-center @5xl:flex-nowrap @5xl:justify-self-end">
            {page.slug === "urls" ? <Button variant="outline" size="sm" disabled>Publish to apply URLs</Button> : dirty ? (
              <Button variant="outline" size="sm" hoverEffect="sweep" disabled>{previewLabel}</Button>
            ) : (
              <Button asChild variant="outline" size="sm" hoverEffect="sweep"><a href={`/api/cms-preview?slug=${page.slug}`} target="_blank" rel="noreferrer">{previewLabel}</a></Button>
            )}
            {page.route && (
              <Button asChild variant="outline" size="sm" hoverEffect="sweep">
                <a href={page.route} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon aria-hidden="true" className="size-4" />
                  View page
                </a>
              </Button>
            )}
            <CmsResetDialog
              targetLabel={page.label}
              actionLabel="Restore published"
              title="Restore the last published content?"
              description="This replaces the content in your editor with the live version. Save draft to keep the restoration. Your public page stays as it is."
              disabled={isPending || (!dirty && !publishedPending)}
              onReset={() => { setValues(structuredClone(live)); toast.success("Published content restored", { description: "Save draft to keep this restoration." }); }}
            />
            <CmsResetDialog
              targetLabel={page.label}
              description="Every field on this page will return to its built-in content. The live page will not change until you publish the reset draft."
              onReset={handleReset}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              hoverEffect="sweep"
              onClick={handleSave}
              disabled={isPending || !dirty}
            >
              {isPending ? (
                <Loader2Icon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <SaveIcon aria-hidden="true" className="size-4" />
              )}
              Save draft
            </Button>
            <Button
              type="button"
              tone="brand"
              size="sm"
              hoverEffect="sweep"
              onClick={handlePublish}
              disabled={isPending}
            >
              <UploadIcon aria-hidden="true" className="size-4" />
              Publish
            </Button>
          </div>
        </div>

        {page.editableNote && (
          <p className="flex items-center gap-2 rounded-(--radius-control) border border-info/30 bg-info-wash px-3.5 py-2.5 text-console-body text-info-ink">
            <InfoIcon aria-hidden="true" className="size-4 shrink-0" />
            {page.editableNote}
          </p>
        )}

        {(dirty || publishedPending) && (
          <p className="flex items-center gap-2 rounded-(--radius-control) border border-warning/30 bg-warning-wash px-3.5 py-2.5 text-console-body text-warning-ink">
            <RotateCcwIcon aria-hidden="true" className="size-4 shrink-0" />
            {dirty
              ? "You have unsaved changes on this page."
              : "Saved as a draft. Publish to make these changes live."}
          </p>
        )}


        <Tabs value={section} onValueChange={setSection} className="min-w-0 gap-4">
          <ScrollArea className="min-w-0 w-full">
            <TabsList className="w-max">
              {page.sections.map((entry) => (
                <TabsTrigger key={entry.key} value={entry.key} className="gap-1.5">
                  <CmsIcon name={entry.icon} className="size-4" />
                  {entry.label}
                  {sectionHasUnpublished(entry.key) && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-brand"
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {page.sections.map((entry) => (
            <TabsContent key={entry.key} value={entry.key} className="mt-0 min-w-0">
              <Card className="min-w-0 gap-0 border border-border bg-surface-raised py-0">
                <CardHeader className="min-w-0 grid-cols-1 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex min-w-0 flex-col gap-3 @2xl:flex-row @2xl:items-start @2xl:justify-between @2xl:gap-6">
                    <div className="min-w-0">
                      <div className="flex min-h-tap items-center gap-2.5">
                        <CmsIcon name={entry.icon} className="size-5 shrink-0 text-brand" />
                        <h2 className="min-w-0 wrap-break-word text-console-title font-medium text-text-primary">
                          {entry.title}
                        </h2>
                      </div>
                      <p className="mt-1 max-w-prose text-console-body text-text-secondary">
                        {entry.description}
                      </p>
                    </div>
                    <CmsResetDialog
                      targetLabel={entry.title}
                      description="Only this section will return to its built-in content. Your other sections will remain unchanged, and the live page will not change until you publish."
                      onReset={() => handleSectionReset(entry.key)}
                      disabled={
                        isPending || !isSectionCustomised(page, values, entry.key)
                      }
                      className="shrink-0 self-start"
                    />
                  </div>
                </CardHeader>
                <CardContent
                  className={cn("min-w-0 flex flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6")}
                >
                  {entry.fields.map((field) => {
                    const value = values[entry.key]?.[field.key];
                    const baseline = live[entry.key]?.[field.key];
                    const onReset = () => resetField(entry.key, field.key);

                    if (field.kind === "text" || field.kind === "textarea") {
                      return (
                        <CmsTextInput
                          key={field.key}
                          field={field}
                          value={typeof value === "string" ? value : ""}
                          baseline={typeof baseline === "string" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "image") {
                      return (
                        <CmsImageInput
                          key={field.key}
                          slug={page.slug}
                          field={field}
                          value={typeof value === "string" ? value : ""}
                          baseline={typeof baseline === "string" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "media") {
                      return (
                        <CmsMediaInput
                          key={field.key}
                          slug={page.slug}
                          field={field}
                          value={(Array.isArray(value) ? value : []) as readonly CmsMediaItem[]}
                          baseline={
                            Array.isArray(baseline)
                              ? (baseline as readonly CmsMediaItem[])
                              : undefined
                          }
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "icon") {
                      return (
                        <CmsIconInput
                          key={field.key}
                          field={field}
                          value={typeof value === "string" ? value : ""}
                          baseline={typeof baseline === "string" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "list") {
                      return (
                        <CmsListInput
                          key={field.key}
                          field={field}
                          value={(Array.isArray(value) ? value : []) as readonly string[]}
                          baseline={
                            Array.isArray(baseline)
                              ? (baseline as readonly string[])
                              : undefined
                          }
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "lines") {
                      return (
                        <CmsLinesInput
                          key={field.key}
                          field={field}
                          value={typeof value === "string" ? value : ""}
                          baseline={typeof baseline === "string" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "select") {
                      return (
                        <CmsSelectInput
                          key={field.key}
                          field={field}
                          value={typeof value === "string" ? value : ""}
                          baseline={typeof baseline === "string" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "toggle") {
                      return (
                        <CmsToggleInput
                          key={field.key}
                          field={field}
                          value={value === true}
                          baseline={typeof baseline === "boolean" ? baseline : undefined}
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    if (field.kind === "repeater") {
                      return (
                        <CmsRepeaterInput
                          key={field.key}
                          slug={page.slug}
                          field={field}
                          value={(Array.isArray(value) ? value : []) as readonly CmsRepeaterItem[]}
                          baseline={
                            Array.isArray(baseline)
                              ? (baseline as readonly CmsRepeaterItem[])
                              : undefined
                          }
                          onChange={(next) => setField(entry.key, field.key, next)}
                          onReset={onReset}
                        />
                      );
                    }

                    return null;
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
