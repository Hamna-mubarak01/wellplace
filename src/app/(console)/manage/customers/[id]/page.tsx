import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { hasPermission, requireManagement } from "@/lib/auth/session";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { listInvoices } from "@/lib/db/queries/invoices";
import { findManagementCustomer } from "@/lib/db/queries/management-customers";
import { createClient } from "@/lib/db/server";
import { idSchema } from "@/lib/validation/console-inputs";
import { ConsolePage } from "@/components/console/console-page";
import { CustomerBookingsTable } from "@/components/console/manage/customers/customer-bookings-table";
import { CustomerDocuments } from "@/components/console/manage/customers/customer-documents";
import { CustomerFlagChips } from "@/components/console/manage/customers/customer-flag-chips";
import { CustomerPaymentsTable } from "@/components/console/manage/customers/customer-payments-table";
import { CustomerProfileSection } from "@/components/console/manage/customers/customer-profile-section";
import { CustomerRecordStats } from "@/components/console/manage/customers/customer-record-stats";
import { CustomerStatusChip } from "@/components/console/manage/customers/customer-status-chip";
import {
  customerFlags,
  customerStatus,
  displayName,
  formatPhone,
  receiptsFromPayments,
  splitDocuments,
} from "@/components/console/manage/customers/customer-view";
import { CustomerBlockDialog } from "@/components/console/manage/customers/customer-block-dialog";
import { CustomerBlockedNotice } from "@/components/console/manage/customers/customer-blocked-notice";
import { CustomerDeleteDialog } from "@/components/console/manage/customers/customer-delete-dialog";
import { CustomerFormDialog } from "@/components/console/manage/customers/customer-form-dialog";
import { DetailTabs } from "@/components/console/shared/detail-tabs";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import {
  BOOKINGS_PAGE_PARAM,
  CUSTOMERS_PATH,
  customerBookingsHref,
  positivePage,
  shownPage,
  type CustomersSearchParams,
} from "@/app/(console)/manage/customers/customers-query";

export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};

const BACK_LABEL = "Back to customers";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CustomersSearchParams>;
}) {
  const session = await requireManagement();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(id).success) notFound();

  const requestedPage = positivePage(query[BOOKINGS_PAGE_PARAM]);
  const client = await createClient();
  const [lookup, creditNotes] = await Promise.all([
    findManagementCustomer(client, id, { bookingsPage: requestedPage }),
    listInvoices(client, {
      customerId: id,
      type: "credit_note",
      page: 1,
      pageSize: MANAGEMENT_LIST.customerDocumentsLimit,
    }),
  ]);

  if (lookup.outcome === "not_found") notFound();
  if (lookup.outcome === "failed") {
    return (
      <ConsolePage title="Customer" backHref={CUSTOMERS_PATH} backLabel={BACK_LABEL}>
        <ConsoleReadError title="This customer could not be loaded" message={lookup.message} />
      </ConsolePage>
    );
  }

  const { customer, bookings, bookingsTotal, payments, paymentsTotal, documents, documentsTotal } = lookup.detail;
  const pageSize = MANAGEMENT_LIST.customerBookingsPageSize;
  const bookingsPage = shownPage(requestedPage, bookingsTotal, pageSize);
  const { invoices, acceptances } = splitDocuments(documents);
  const receipts = receiptsFromPayments(payments);
  const phone = formatPhone(customer.phoneE164);
  const flags = customerFlags(customer);

  return (
    <ConsolePage
      title={displayName(customer)}
      backHref={CUSTOMERS_PATH}
      backLabel={BACK_LABEL}
      meta={[
        <span key="reference" className="font-data tabular-nums">{customer.reference}</span>,
        customer.email === "" ? null : <span key="email" className="break-all">{customer.email}</span>,
        phone === "" ? null : <span key="phone" className="font-data tabular-nums">{phone}</span>,
      ]}
      status={
        <>
          <CustomerStatusChip status={customerStatus(customer)} />
          <CustomerFlagChips flags={flags} />
        </>
      }
      actions={
        hasPermission(session, "correct_customer_record") ? (
          <>
            <CustomerFormDialog customer={customer} />
            <CustomerBlockDialog
              customer={{ id: customer.id, name: displayName(customer) }}
              blocked={customer.isBlocked}
            />
            <CustomerDeleteDialog customer={{ id: customer.id, name: displayName(customer) }} redirectTo={CUSTOMERS_PATH} />
          </>
        ) : undefined
      }
    >
      <CustomerBlockedNotice isBlocked={customer.isBlocked} />

      <CustomerProfileSection customer={customer} />

      <CustomerRecordStats customer={customer} />

      <DetailTabs
        label="Customer record"
        tabs={[
          {
            value: "bookings",
            label: "Bookings",
            count: bookingsTotal,
            content: (
              <CustomerBookingsTable
                rows={bookings}
                page={bookingsPage}
                pageSize={pageSize}
                total={bookingsTotal}
                hrefForPage={(target) => customerBookingsHref(customer.id, target)}
              />
            ),
          },
          {
            value: "payments",
            label: "Payments",
            count: paymentsTotal,
            content: <CustomerPaymentsTable rows={payments} total={paymentsTotal} />,
          },
          {
            value: "documents",
            label: "Documents",
            count: documentsTotal + receipts.length + (creditNotes.ok ? creditNotes.total : 0),
            content: (
              <CustomerDocuments
                acceptances={acceptances}
                invoices={invoices}
                creditNotes={creditNotes}
                receipts={receipts}
                shownDocuments={documents.length}
                totalDocuments={documentsTotal}
                receiptsComplete={payments.length >= paymentsTotal}
              />
            ),
          },
        ]}
      />
    </ConsolePage>
  );
}
