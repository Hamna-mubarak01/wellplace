"use client";

import { useState, type ReactNode } from "react";

import type { CouponRow } from "@/lib/config/coupons";
import { CouponEditorContext } from "@/components/console/manage/coupons/coupon-editor-context";
import type { CouponAddonChoices } from "@/components/console/manage/coupons/coupon-terms-model";
import { CreateCouponsDialog } from "@/components/console/manage/coupons/create-coupons-dialog";
import { EditCouponDialog } from "@/components/console/manage/coupons/edit-coupon-dialog";

export interface CouponsWorkspaceProps {
  addons: CouponAddonChoices;
  children: ReactNode;
}

export function CouponsWorkspace({ addons, children }: CouponsWorkspaceProps) {
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState(0);

  const create = () => {
    setSession((current) => current + 1);
    setCreating(true);
  };

  return (
    <CouponEditorContext.Provider value={{ create, edit: setEditing }}>
      {children}
      {editing !== null && (
        <EditCouponDialog
          key={editing.id ?? editing.code}
          coupon={editing}
          addons={addons}
          onClose={() => setEditing(null)}
        />
      )}
      <CreateCouponsDialog key={session} open={creating} addons={addons} onClose={() => setCreating(false)} />
    </CouponEditorContext.Provider>
  );
}
