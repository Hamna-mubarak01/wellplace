"use client";

import { useState } from "react";
import { ClockIcon, PackageIcon, PencilIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { NEW_ADDON, NEW_PRICE, priceTitle, type EditableAddon, type EditablePrice } from "@/lib/config/catalogue";
import { Button } from "@/components/shared/button";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import { MediaFrame } from "@/components/shared/media-frame";
import { AddonEditor } from "@/components/console/manage/addon-editor";
import { CatalogueEditor } from "@/components/console/manage/catalogue-editor";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { DetailTabs } from "@/components/console/shared/detail-tabs";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";

function activeChip(isActive: boolean) {
  return <StatusChip tone={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Off"}</StatusChip>;
}

export function CatalogueWorkspace({ prices, addons }: { prices: EditablePrice[]; addons: EditableAddon[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ kind: "price" | "addon"; value: EditablePrice | EditableAddon }>();
  const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const searching = query.trim() !== "";
  const rates = prices.filter((p) => matches(priceTitle(p)));
  const items = addons.filter((a) => matches(`${a.name} ${a.description ?? ""}`));

  const rateColumns: readonly ConsoleColumn<EditablePrice>[] = [
    {
      id: "rate",
      header: "Rate",
      cell: (p) => <span className="font-medium">{priceTitle(p)}</span>,
    },
    {
      id: "regular",
      header: "Regular per hour",
      align: "end",
      cell: (p) => <MoneyValue fils={p.regular_fils_per_hour} />,
    },
    {
      id: "offer",
      header: "Offer per hour",
      align: "end",
      cell: (p) =>
        p.offer_fils_per_hour === null ? (
          <span className="font-data tabular-nums whitespace-nowrap">{p.offer_percent}% off</span>
        ) : (
          <MoneyValue fils={p.offer_fils_per_hour} />
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => activeChip(p.is_active),
    },
  ];

  const addonColumns: readonly ConsoleColumn<EditableAddon>[] = [
    {
      id: "addon",
      header: "Add-on",
      wrap: true,
      cell: (a) => (
        <span className="flex min-w-48 items-center gap-3">
          <MediaFrame
            src={a.image_path ?? ""}
            alt={a.name}
            sizes="48px"
            frameClassName="size-12 shrink-0 rounded-(--radius-control)"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium break-words">{a.name}</span>
            {a.description && (
              <span className="line-clamp-2 text-micro text-pretty text-text-secondary">{a.description}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: "price",
      header: "Price",
      align: "end",
      cell: (a) => <MoneyValue fils={a.offer_price_fils} />,
    },
    {
      id: "stock",
      header: "Stock",
      cell: (a) => (a.inventory === 0 ? <StatusChip tone="warning">Sold out</StatusChip> : "Available"),
    },
    {
      id: "status",
      header: "Status",
      cell: (a) => activeChip(a.is_active),
    },
  ];

  return <div className="flex min-w-0 flex-col gap-6">
    <div role="search" aria-label="Filter prices and add-ons" className="flex min-w-0">
      <ConsoleSearchInput value={query} onChange={setQuery} label="Search prices and add-ons" placeholder="Search rates or add-ons" />
    </div>

    <DetailTabs
      label="Prices and add-ons"
      tabs={[
        {
          value: "rates",
          label: "Hourly rates",
          count: rates.length,
          content: (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-console-body text-text-secondary">Changes apply to new quotes. Existing bookings keep their prices.</p>
                <Button onClick={() => setEditing({ kind: "price", value: { ...NEW_PRICE } })}>
                  <PlusIcon aria-hidden="true" className="size-4" />
                  Add rate
                </Button>
              </div>
              <ConsoleDataTable
                label="Hourly rates"
                columns={rateColumns}
                rows={rates}
                rowKey={(p) => p.id ?? priceTitle(p)}
                actions={(p) => (
                  <ConsoleIconAction
                    label={`Edit ${priceTitle(p)}`}
                    Icon={PencilIcon}
                    onClick={() => setEditing({ kind: "price", value: p })}
                  />
                )}
                empty={
                  searching
                    ? {
                        title: "No rates match this search",
                        description: "Search by another rate, or clear the search to see every rate.",
                        Icon: SearchXIcon,
                      }
                    : {
                        title: "No hourly rates yet",
                        description: "Add an hourly rate to start calculating booking prices.",
                        Icon: ClockIcon,
                      }
                }
              />
            </div>
          ),
        },
        {
          value: "addons",
          label: "Add-ons",
          count: items.length,
          content: (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-console-body text-text-secondary">An active item offered at AED 0 is included automatically.</p>
                <Button onClick={() => setEditing({ kind: "addon", value: { ...NEW_ADDON } })}>
                  <PlusIcon aria-hidden="true" className="size-4" />
                  Add item
                </Button>
              </div>
              <ConsoleDataTable
                label="Add-ons"
                columns={addonColumns}
                rows={items}
                rowKey={(a) => a.id ?? a.name}
                actions={(a) => (
                  <ConsoleIconAction
                    label={`Edit ${a.name}`}
                    Icon={PencilIcon}
                    onClick={() => setEditing({ kind: "addon", value: a })}
                  />
                )}
                empty={
                  searching
                    ? {
                        title: "No add-ons match this search",
                        description: "Search by another name, or clear the search to see every add-on.",
                        Icon: SearchXIcon,
                      }
                    : {
                        title: "No add-ons yet",
                        description: "Add an item when its description and price are ready.",
                        Icon: PackageIcon,
                      }
                }
              />
            </div>
          ),
        },
      ]}
    />

    {editing && (editing.kind === "addon" ? <AddonEditor key={editing.value.id ?? "new"} initial={editing.value as EditableAddon} onClose={() => setEditing(undefined)} /> : <CatalogueEditor key={editing.value.id ?? "new"} kind="price" initial={editing.value} onClose={() => setEditing(undefined)} />)}
  </div>;
}
