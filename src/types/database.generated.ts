export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      acceptance_records: {
        Row: {
          accepted_at: string
          booking_id: string
          checkbox_text: string
          document_slug: string
          document_version: string
          id: string
          source: Database["public"]["Enums"]["booking_source"]
        }
        Insert: {
          accepted_at?: string
          booking_id: string
          checkbox_text: string
          document_slug: string
          document_version: string
          id?: string
          source: Database["public"]["Enums"]["booking_source"]
        }
        Update: {
          accepted_at?: string
          booking_id?: string
          checkbox_text?: string
          document_slug?: string
          document_version?: string
          id?: string
          source?: Database["public"]["Enums"]["booking_source"]
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "acceptance_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "acceptance_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "acceptance_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      addons: {
        Row: {
          available_from: string | null
          available_to: string | null
          created_at: string
          default_quantity: number
          description: string | null
          eligible_max_guests: number | null
          eligible_max_hours: number | null
          eligible_min_guests: number | null
          eligible_min_hours: number | null
          id: string
          image_path: string | null
          inventory: number | null
          is_active: boolean
          is_locked: boolean
          is_taxable: boolean
          kind: Database["public"]["Enums"]["addon_kind"]
          max_quantity: number
          min_quantity: number
          name: string
          offer_price_fils: number
          reception_note: string | null
          regular_price_fils: number
          saving_label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          default_quantity?: number
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string
          image_path?: string | null
          inventory?: number | null
          is_active?: boolean
          is_locked?: boolean
          is_taxable?: boolean
          kind?: Database["public"]["Enums"]["addon_kind"]
          max_quantity?: number
          min_quantity?: number
          name: string
          offer_price_fils: number
          reception_note?: string | null
          regular_price_fils: number
          saving_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          default_quantity?: number
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string
          image_path?: string | null
          inventory?: number | null
          is_active?: boolean
          is_locked?: boolean
          is_taxable?: boolean
          kind?: Database["public"]["Enums"]["addon_kind"]
          max_quantity?: number
          min_quantity?: number
          name?: string
          offer_price_fils?: number
          reception_note?: string | null
          regular_price_fils?: number
          saving_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          detail: Json | null
          entity: string
          entity_id: string
          id: string
          kind: Database["public"]["Enums"]["alert_kind"]
          opened_at: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Insert: {
          detail?: Json | null
          entity: string
          entity_id: string
          id?: string
          kind: Database["public"]["Enums"]["alert_kind"]
          opened_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Update: {
          detail?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["alert_kind"]
          opened_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          addon_id: string | null
          booking_id: string
          created_at: string
          id: string
          is_included: boolean
          is_locked: boolean
          is_taxable: boolean
          line_total_fils: number | null
          name_snapshot: string
          quantity: number
          regular_price_fils: number | null
          unit_price_fils: number
          voucher_code: string | null
        }
        Insert: {
          addon_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          is_included?: boolean
          is_locked?: boolean
          is_taxable: boolean
          line_total_fils?: number | null
          name_snapshot: string
          quantity?: number
          regular_price_fils?: number | null
          unit_price_fils: number
          voucher_code?: string | null
        }
        Update: {
          addon_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          is_included?: boolean
          is_locked?: boolean
          is_taxable?: boolean
          line_total_fils?: number | null
          name_snapshot?: string
          quantity?: number
          regular_price_fils?: number | null
          unit_price_fils?: number
          voucher_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "management_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "public_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "staff_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      booking_guests: {
        Row: {
          age: number | null
          booking_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["guest_kind"]
        }
        Insert: {
          age?: number | null
          booking_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["guest_kind"]
        }
        Update: {
          age?: number | null
          booking_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["guest_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      bookings: {
        Row: {
          addons_fils: number
          arrived_at: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          cleaning_buffer_minutes: number
          created_at: string
          created_by: string | null
          customer_id: string
          discount_fils: number
          experience_period: unknown
          id: string
          internal_note: string | null
          is_complimentary: boolean
          is_simulated: boolean
          late_arrival_minutes: number | null
          occupancy_id: string | null
          overrun_fils: number | null
          overrun_minutes: number | null
          personal_request: string | null
          reference: string
          service_fee_fils: number
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_fils: number
          suite_id: string | null
          tax_fils: number
          total_fils: number
          updated_at: string
        }
        Insert: {
          addons_fils?: number
          arrived_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_buffer_minutes: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_fils?: number
          experience_period: unknown
          id?: string
          internal_note?: string | null
          is_complimentary?: boolean
          is_simulated?: boolean
          late_arrival_minutes?: number | null
          occupancy_id?: string | null
          overrun_fils?: number | null
          overrun_minutes?: number | null
          personal_request?: string | null
          reference: string
          service_fee_fils?: number
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_fils?: number
          suite_id?: string | null
          tax_fils?: number
          total_fils?: number
          updated_at?: string
        }
        Update: {
          addons_fils?: number
          arrived_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          cleaning_buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_fils?: number
          experience_period?: unknown
          id?: string
          internal_note?: string | null
          is_complimentary?: boolean
          is_simulated?: boolean
          late_arrival_minutes?: number | null
          occupancy_id?: string | null
          overrun_fils?: number | null
          overrun_minutes?: number | null
          personal_request?: string | null
          reference?: string
          service_fee_fils?: number
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_fils?: number
          suite_id?: string | null
          tax_fils?: number
          total_fils?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "reception_board"
            referencedColumns: ["occupancy_id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "reception_schedule"
            referencedColumns: ["occupancy_id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "suite_occupancy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_from: string
          id: string
          note: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["cleaning_status"]
          suite_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_from: string
          id?: string
          note?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          suite_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_from?: string
          id?: string
          note?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          suite_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content: {
        Row: {
          draft_data: Json
          published_at: string | null
          published_by: string | null
          published_data: Json | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          draft_data?: Json
          published_at?: string | null
          published_by?: string | null
          published_data?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["cms_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          draft_data?: Json
          published_at?: string | null
          published_by?: string | null
          published_data?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["cms_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_versions: {
        Row: {
          created_at: string
          created_by: string | null
          created_email: string | null
          data: Json
          id: number
          label: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          data: Json
          id?: never
          label?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          data?: Json
          id?: never
          label?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_versions_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "cms_content"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "cms_content_versions_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "cms_published_content"
            referencedColumns: ["slug"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_fils: number
          bill_to: Json
          booking_id: string
          credit_note_number: string
          currency: string
          customer_id: string
          id: string
          invoice_id: string
          invoice_issued_at: string
          invoice_number: string
          is_test: boolean
          issued_at: string
          issued_by: string | null
          issuer: Json
          lines: Json
          reason: string
          refund: Json
          refund_id: string
          sequence_no: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_fils: number
          bill_to: Json
          booking_id: string
          credit_note_number: string
          currency: string
          customer_id: string
          id?: string
          invoice_id: string
          invoice_issued_at: string
          invoice_number: string
          is_test: boolean
          issued_at?: string
          issued_by?: string | null
          issuer: Json
          lines: Json
          reason: string
          refund: Json
          refund_id: string
          sequence_no: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_fils?: number
          bill_to?: Json
          booking_id?: string
          credit_note_number?: string
          currency?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          invoice_issued_at?: string
          invoice_number?: string
          is_test?: boolean
          issued_at?: string
          issued_by?: string | null
          issuer?: Json
          lines?: Json
          reason?: string
          refund?: Json
          refund_id?: string
          sequence_no?: number
          supply_date?: string
          tax?: Json
          tax_fils?: number
          taxable_fils?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "management_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "management_refund_ledger"
            referencedColumns: ["refund_id"]
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string
          id: string
          identity_key: string | null
          internal_note: string | null
          is_blocked: boolean
          last_interaction_at: string
          last_name: string
          phone_country: string
          phone_e164: string
          reference: string
          salutation: Database["public"]["Enums"]["salutation"] | null
          updated_at: string
          warning_note: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name: string
          id?: string
          identity_key?: string | null
          internal_note?: string | null
          is_blocked?: boolean
          last_interaction_at?: string
          last_name: string
          phone_country: string
          phone_e164: string
          reference?: string
          salutation?: Database["public"]["Enums"]["salutation"] | null
          updated_at?: string
          warning_note?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string
          id?: string
          identity_key?: string | null
          internal_note?: string | null
          is_blocked?: boolean
          last_interaction_at?: string
          last_name?: string
          phone_country?: string
          phone_e164?: string
          reference?: string
          salutation?: Database["public"]["Enums"]["salutation"] | null
          updated_at?: string
          warning_note?: string | null
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount_fils: number
          invoice_id: string
          payment_id: string
          tax_fils: number
          voided_at: string | null
        }
        Insert: {
          amount_fils: number
          invoice_id: string
          payment_id: string
          tax_fils: number
          voided_at?: string | null
        }
        Update: {
          amount_fils?: number
          invoice_id?: string
          payment_id?: string
          tax_fils?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "management_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "management_payment_ledger"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "invoice_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          addons_fils: number
          bill_to: Json
          booking_id: string
          currency: string
          customer_id: string
          discount_fils: number
          id: string
          invoice_number: string
          is_test: boolean
          issued_at: string
          issued_by: string | null
          issuer: Json
          lines: Json
          overrun_fils: number
          paid_fils: number
          payments: Json
          replaces_invoice_id: string | null
          sequence_no: number
          service_fee_fils: number
          subtotal_fils: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          total_fils: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          addons_fils: number
          bill_to: Json
          booking_id: string
          currency: string
          customer_id: string
          discount_fils: number
          id?: string
          invoice_number: string
          is_test?: boolean
          issued_at?: string
          issued_by?: string | null
          issuer: Json
          lines: Json
          overrun_fils?: number
          paid_fils: number
          payments?: Json
          replaces_invoice_id?: string | null
          sequence_no: number
          service_fee_fils: number
          subtotal_fils: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils?: number
          total_fils: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          addons_fils?: number
          bill_to?: Json
          booking_id?: string
          currency?: string
          customer_id?: string
          discount_fils?: number
          id?: string
          invoice_number?: string
          is_test?: boolean
          issued_at?: string
          issued_by?: string | null
          issuer?: Json
          lines?: Json
          overrun_fils?: number
          paid_fils?: number
          payments?: Json
          replaces_invoice_id?: string | null
          sequence_no?: number
          service_fee_fils?: number
          subtotal_fils?: number
          supply_date?: string
          tax?: Json
          tax_fils?: number
          taxable_fils?: number
          total_fils?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaces_invoice_id_fkey"
            columns: ["replaces_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaces_invoice_id_fkey"
            columns: ["replaces_invoice_id"]
            isOneToOne: false
            referencedRelation: "management_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_consent_events: {
        Row: {
          consent_text: string | null
          customer_id: string | null
          granted: boolean
          id: string
          occurred_at: string
          origin: Database["public"]["Enums"]["consent_origin"]
          seq: number
          waitlist_entry_id: string | null
        }
        Insert: {
          consent_text?: string | null
          customer_id?: string | null
          granted: boolean
          id?: string
          occurred_at?: string
          origin: Database["public"]["Enums"]["consent_origin"]
          seq?: never
          waitlist_entry_id?: string | null
        }
        Update: {
          consent_text?: string | null
          customer_id?: string | null
          granted?: boolean
          id?: string
          occurred_at?: string
          origin?: Database["public"]["Enums"]["consent_origin"]
          seq?: never
          waitlist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "marketing_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "marketing_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_consent_events_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_consent_events_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          document: Json | null
          document_updated_at: string | null
          draft_document: Json | null
          draft_preheader: string | null
          draft_subject: string | null
          draft_updated_at: string | null
          footer: string | null
          footer_design: Json | null
          header_design: Json | null
          is_active: boolean
          is_marketing: boolean
          key: string
          preheader: string | null
          subject: string | null
          timing_minutes: number | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          document?: Json | null
          document_updated_at?: string | null
          draft_document?: Json | null
          draft_preheader?: string | null
          draft_subject?: string | null
          draft_updated_at?: string | null
          footer?: string | null
          footer_design?: Json | null
          header_design?: Json | null
          is_active?: boolean
          is_marketing?: boolean
          key: string
          preheader?: string | null
          subject?: string | null
          timing_minutes?: number | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          document?: Json | null
          document_updated_at?: string | null
          draft_document?: Json | null
          draft_preheader?: string | null
          draft_subject?: string | null
          draft_updated_at?: string | null
          footer?: string | null
          footer_design?: Json | null
          header_design?: Json | null
          is_active?: boolean
          is_marketing?: boolean
          key?: string
          preheader?: string | null
          subject?: string | null
          timing_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attempt_count: number
          body: string | null
          booking_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          customer_id: string | null
          error: string | null
          failed_at: string | null
          id: string
          is_marketing: boolean
          last_attempt_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
          template_key: string
          to_address: string
        }
        Insert: {
          attempt_count?: number
          body?: string | null
          booking_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          customer_id?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          is_marketing: boolean
          last_attempt_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          template_key: string
          to_address: string
        }
        Update: {
          attempt_count?: number
          body?: string | null
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          customer_id?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          is_marketing?: boolean
          last_attempt_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          template_key?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          booking_id: string | null
          id: string
          payload: Json | null
          payment_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          booking_id?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          signature_verified: boolean
        }
        Update: {
          booking_id?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "management_payment_ledger"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_fees: {
        Row: {
          created_at: string
          customer_label: string
          is_enabled: boolean
          method: Database["public"]["Enums"]["payment_method"]
          percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          customer_label: string
          is_enabled?: boolean
          method: Database["public"]["Enums"]["payment_method"]
          percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          customer_label?: string
          is_enabled?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_fees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_fils: number
          booking_id: string
          created_at: string
          id: string
          is_simulated: boolean
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          provider_reference: string | null
          recorded_at: string
          recorded_by: string | null
          reference: string
          service_fee_fils: number
          status: Database["public"]["Enums"]["payment_status"]
          tax_fils: number
          taxable_fils: number
          updated_at: string
        }
        Insert: {
          amount_fils: number
          booking_id: string
          created_at?: string
          id?: string
          is_simulated?: boolean
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          provider_reference?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reference?: string
          service_fee_fils?: number
          status: Database["public"]["Enums"]["payment_status"]
          tax_fils?: number
          taxable_fils?: number
          updated_at?: string
        }
        Update: {
          amount_fils?: number
          booking_id?: string
          created_at?: string
          id?: string
          is_simulated?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          provider_reference?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reference?: string
          service_fee_fils?: number
          status?: Database["public"]["Enums"]["payment_status"]
          tax_fils?: number
          taxable_fils?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          code: string | null
          created_at: string
          from_hour: number
          guest_kind: Database["public"]["Enums"]["guest_price_kind"]
          id: string
          is_active: boolean
          offer_fils_per_hour: number | null
          offer_percent: number | null
          priority: number
          regular_fils_per_hour: number
          season_from: string | null
          season_to: string | null
          start_from_minutes: number | null
          start_to_minutes: number | null
          to_hour: number | null
          updated_at: string
          weekdays: number[] | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          from_hour: number
          guest_kind: Database["public"]["Enums"]["guest_price_kind"]
          id?: string
          is_active?: boolean
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number
          regular_fils_per_hour: number
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          updated_at?: string
          weekdays?: number[] | null
        }
        Update: {
          code?: string | null
          created_at?: string
          from_hour?: number
          guest_kind?: Database["public"]["Enums"]["guest_price_kind"]
          id?: string
          is_active?: boolean
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number
          regular_fils_per_hour?: number
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          updated_at?: string
          weekdays?: number[] | null
        }
        Relationships: []
      }
      promo_code_addons: {
        Row: {
          addon_id: string
          created_at: string
          promo_code_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          promo_code_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "management_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "public_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "staff_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_addons_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_redemptions: {
        Row: {
          booking_id: string
          code_snapshot: string
          customer_id: string
          id: string
          promo_code_id: string
          redeemed_at: string
        }
        Insert: {
          booking_id: string
          code_snapshot: string
          customer_id: string
          id?: string
          promo_code_id: string
          redeemed_at?: string
        }
        Update: {
          booking_id?: string
          code_snapshot?: string
          customer_id?: string
          id?: string
          promo_code_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          amount_fils: number | null
          batch_id: string | null
          batch_name: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_combinable: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          max_uses: number | null
          per_customer_limit: number | null
          percent: number | null
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          amount_fils?: number | null
          batch_id?: string | null
          batch_name?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_combinable?: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          max_uses?: number | null
          per_customer_limit?: number | null
          percent?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          amount_fils?: number | null
          batch_id?: string | null
          batch_name?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_combinable?: boolean
          kind?: Database["public"]["Enums"]["promo_kind"]
          max_uses?: number | null
          per_customer_limit?: number | null
          percent?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_fils: number
          booking_id: string
          id: string
          is_pending: boolean
          payment_id: string
          provider_reference: string | null
          reason: string
          reference: string
          request_key: string | null
          requested_at: string
          requested_by: string | null
          settled_at: string | null
          tax_fils: number
          withdrawal_reason: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          amount_fils: number
          booking_id: string
          id?: string
          is_pending?: boolean
          payment_id: string
          provider_reference?: string | null
          reason: string
          reference?: string
          request_key?: string | null
          requested_at?: string
          requested_by?: string | null
          settled_at?: string | null
          tax_fils?: number
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          amount_fils?: number
          booking_id?: string
          id?: string
          is_pending?: boolean
          payment_id?: string
          provider_reference?: string | null
          reason?: string
          reference?: string
          request_key?: string | null
          requested_at?: string
          requested_by?: string | null
          settled_at?: string | null
          tax_fils?: number
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "management_payment_ledger"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_withdrawn_by_fkey"
            columns: ["withdrawn_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string
          key: string
          source_tag: string
          updated_at: string
          updated_by: string | null
          value: Json | null
          value_type: string
        }
        Insert: {
          description: string
          key: string
          source_tag: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
          value_type: string
        }
        Update: {
          description?: string
          key?: string
          source_tag?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
          value_type?: string
        }
        Relationships: []
      }
      shift_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          handed_over_at: string | null
          id: string
          shift_on: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          handed_over_at?: string | null
          id?: string
          shift_on: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          handed_over_at?: string | null
          id?: string
          shift_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_at: string
          invited_by: string | null
          last_resent_at: string | null
          resend_count: number
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_resent_at?: string | null
          resend_count?: number
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_resent_at?: string | null
          resend_count?: number
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission: Database["public"]["Enums"]["named_permission"]
          reason: string | null
          staff_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission: Database["public"]["Enums"]["named_permission"]
          reason?: string | null
          staff_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission?: Database["public"]["Enums"]["named_permission"]
          reason?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_occupancy: {
        Row: {
          blocked_period: unknown
          booking_id: string | null
          cleaning_buffer_minutes: number
          created_at: string
          created_by: string | null
          experience_period: unknown
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["occupancy_kind"]
          reason: string | null
          status: Database["public"]["Enums"]["occupancy_status"]
          suite_id: string
          updated_at: string
        }
        Insert: {
          blocked_period: unknown
          booking_id?: string | null
          cleaning_buffer_minutes: number
          created_at?: string
          created_by?: string | null
          experience_period: unknown
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["occupancy_kind"]
          reason?: string | null
          status?: Database["public"]["Enums"]["occupancy_status"]
          suite_id: string
          updated_at?: string
        }
        Update: {
          blocked_period?: unknown
          booking_id?: string | null
          cleaning_buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          experience_period?: unknown
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["occupancy_kind"]
          reason?: string | null
          status?: Database["public"]["Enums"]["occupancy_status"]
          suite_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      suites: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          internal_note: string | null
          is_active: boolean
          last_allocated_at: string | null
          priority: number
          retired_at: string | null
          retired_by: string | null
          retirement_reason: string | null
          status: Database["public"]["Enums"]["suite_status"]
          suite_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          internal_note?: string | null
          is_active?: boolean
          last_allocated_at?: string | null
          priority?: number
          retired_at?: string | null
          retired_by?: string | null
          retirement_reason?: string | null
          status?: Database["public"]["Enums"]["suite_status"]
          suite_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          internal_note?: string | null
          is_active?: boolean
          last_allocated_at?: string | null
          priority?: number
          retired_at?: string | null
          retired_by?: string | null
          retirement_reason?: string | null
          status?: Database["public"]["Enums"]["suite_status"]
          suite_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suites_retired_by_fkey"
            columns: ["retired_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_on: string | null
          id: string
          note: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_on?: string | null
          id?: string
          note?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_on?: string | null
          id?: string
          note?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          date_of_birth: string
          dedupe_key: string | null
          email: string
          first_name: string
          id: string
          is_spam: boolean
          last_name: string
          last_signup_at: string
          phone_country: string
          phone_e164: string
          referrer: string | null
          salutation: Database["public"]["Enums"]["salutation"]
          signup_count: number
          source: string | null
          terms_acceptance_text: string | null
          terms_acceptance_version: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          date_of_birth: string
          dedupe_key?: string | null
          email: string
          first_name: string
          id?: string
          is_spam?: boolean
          last_name: string
          last_signup_at?: string
          phone_country: string
          phone_e164: string
          referrer?: string | null
          salutation: Database["public"]["Enums"]["salutation"]
          signup_count?: number
          source?: string | null
          terms_acceptance_text?: string | null
          terms_acceptance_version?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          date_of_birth?: string
          dedupe_key?: string | null
          email?: string
          first_name?: string
          id?: string
          is_spam?: boolean
          last_name?: string
          last_signup_at?: string
          phone_country?: string
          phone_e164?: string
          referrer?: string | null
          salutation?: Database["public"]["Enums"]["salutation"]
          signup_count?: number
          source?: string | null
          terms_acceptance_text?: string | null
          terms_acceptance_version?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_detail: {
        Row: {
          addons_fils: number | null
          adults: number | null
          arrived_at: string | null
          blocked_to: string | null
          booking_id: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          checked_in_at: string | null
          checked_out_at: string | null
          child_ages: number[] | null
          children: number | null
          cleaning_buffer_minutes: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          date_of_birth: string | null
          discount_fils: number | null
          display_status: Database["public"]["Enums"]["booking_status"] | null
          email: string | null
          experience_from: string | null
          experience_to: string | null
          first_name: string | null
          guest_name: string | null
          internal_note: string | null
          is_abandoned: boolean | null
          is_blocked: boolean | null
          is_complimentary: boolean | null
          last_name: string | null
          late_arrival_minutes: number | null
          occupancy_id: string | null
          overrun_fils: number | null
          overrun_minutes: number | null
          paid_fils: number | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          personal_request: string | null
          phone_country: string | null
          phone_e164: string | null
          reference: string | null
          refunded_fils: number | null
          refunds_pending_fils: number | null
          salutation: Database["public"]["Enums"]["salutation"] | null
          service_fee_fils: number | null
          source: Database["public"]["Enums"]["booking_source"] | null
          subtotal_fils: number | null
          suite_id: string | null
          suite_number: number | null
          tax_fils: number | null
          total_fils: number | null
          updated_at: string | null
          warning_note: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "reception_board"
            referencedColumns: ["occupancy_id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "reception_schedule"
            referencedColumns: ["occupancy_id"]
          },
          {
            foreignKeyName: "bookings_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: true
            referencedRelation: "suite_occupancy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_messages: {
        Row: {
          attempt_count: number | null
          body: string | null
          booking_id: string | null
          booking_reference: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          created_at: string | null
          customer_id: string | null
          error: string | null
          failed_at: string | null
          has_body: boolean | null
          is_marketing: boolean | null
          last_attempt_at: string | null
          message_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"] | null
          subject: string | null
          template_key: string | null
          to_address: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_search: {
        Row: {
          adults: number | null
          arrived_at: string | null
          booking_id: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          checked_in_at: string | null
          checked_out_at: string | null
          children: number | null
          created_at: string | null
          created_by_name: string | null
          customer_id: string | null
          display_status: Database["public"]["Enums"]["booking_status"] | null
          email: string | null
          experience_from: string | null
          experience_to: string | null
          first_name: string | null
          guest_name: string | null
          is_abandoned: boolean | null
          is_complimentary: boolean | null
          last_name: string | null
          payment_reference: string | null
          payment_references: string[] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          phone_e164: string | null
          reference: string | null
          source: Database["public"]["Enums"]["booking_source"] | null
          suite_id: string | null
          suite_number: number | null
          total_fils: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_board: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          booking_id: string | null
          booking_reference: string | null
          cleaning_task_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_by_name: string | null
          created_at: string | null
          due_from: string | null
          note: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["cleaning_status"] | null
          suite_id: string | null
          suite_number: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cleaning_tasks_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_published_content: {
        Row: {
          published_at: string | null
          published_data: Json | null
          slug: string | null
        }
        Insert: {
          published_at?: string | null
          published_data?: Json | null
          slug?: string | null
        }
        Update: {
          published_at?: string | null
          published_data?: Json | null
          slug?: string | null
        }
        Relationships: []
      }
      management_addons: {
        Row: {
          available_from: string | null
          available_to: string | null
          default_quantity: number | null
          description: string | null
          eligible_max_guests: number | null
          eligible_max_hours: number | null
          eligible_min_guests: number | null
          eligible_min_hours: number | null
          id: string | null
          image_path: string | null
          inventory: number | null
          is_active: boolean | null
          is_locked: boolean | null
          is_taxable: boolean | null
          kind: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity: number | null
          min_quantity: number | null
          name: string | null
          offer_price_fils: number | null
          reception_note: string | null
          regular_price_fils: number | null
          saving_label: string | null
          sort_order: number | null
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          default_quantity?: number | null
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string | null
          image_path?: string | null
          inventory?: number | null
          is_active?: boolean | null
          is_locked?: boolean | null
          is_taxable?: boolean | null
          kind?: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string | null
          offer_price_fils?: number | null
          reception_note?: string | null
          regular_price_fils?: number | null
          saving_label?: string | null
          sort_order?: number | null
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          default_quantity?: number | null
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string | null
          image_path?: string | null
          inventory?: number | null
          is_active?: boolean | null
          is_locked?: boolean | null
          is_taxable?: boolean | null
          kind?: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string | null
          offer_price_fils?: number | null
          reception_note?: string | null
          regular_price_fils?: number | null
          saving_label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      management_credit_notes: {
        Row: {
          amount_fils: number | null
          bill_to: Json | null
          booking_id: string | null
          booking_reference: string | null
          credit_note_number: string | null
          currency: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_reference: string | null
          id: string | null
          invoice_id: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          is_test: boolean | null
          issued_at: string | null
          issued_by: string | null
          issued_by_name: string | null
          issuer: Json | null
          lines: Json | null
          reason: string | null
          refund: Json | null
          refund_id: string | null
          sequence_no: number | null
          state: string | null
          supply_date: string | null
          tax: Json | null
          tax_fils: number | null
          taxable_fils: number | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          voided_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "management_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "management_refund_ledger"
            referencedColumns: ["refund_id"]
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      management_customers: {
        Row: {
          bookings_count: number | null
          cancelled_count: number | null
          completed_count: number | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          first_visit_at: string | null
          full_name: string | null
          id: string | null
          internal_note: string | null
          is_blocked: boolean | null
          is_lead: boolean | null
          last_interaction_at: string | null
          last_name: string | null
          last_visit_at: string | null
          next_visit_at: string | null
          paid_fils: number | null
          phone_country: string | null
          phone_e164: string | null
          reference: string | null
          salutation: Database["public"]["Enums"]["salutation"] | null
          upcoming_count: number | null
          warning_note: string | null
        }
        Relationships: []
      }
      management_documents: {
        Row: {
          bill_to_company: string | null
          bill_to_trn: string | null
          booking_id: string | null
          booking_reference: string | null
          currency: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_reference: string | null
          document_type: string | null
          id: string | null
          is_test: boolean | null
          issued_at: string | null
          issued_by_name: string | null
          number: string | null
          original_invoice_id: string | null
          original_invoice_number: string | null
          paid_fils: number | null
          refund_id: string | null
          replaces_invoice_id: string | null
          sequence_no: number | null
          state: string | null
          suite_number: number | null
          supply_date: string | null
          tax_fils: number | null
          taxable_fils: number | null
          total_fils: number | null
          void_reason: string | null
          voided_at: string | null
        }
        Relationships: []
      }
      management_invoices: {
        Row: {
          addons_fils: number | null
          bill_to: Json | null
          booking_id: string | null
          booking_reference: string | null
          credited_fils: number | null
          currency: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_reference: string | null
          discount_fils: number | null
          id: string | null
          invoice_number: string | null
          is_test: boolean | null
          issued_at: string | null
          issued_by: string | null
          issued_by_name: string | null
          issuer: Json | null
          lines: Json | null
          overrun_fils: number | null
          paid_fils: number | null
          payments: Json | null
          replaces_invoice_id: string | null
          sequence_no: number | null
          service_fee_fils: number | null
          state: string | null
          subtotal_fils: number | null
          suite_id: string | null
          suite_number: number | null
          supply_date: string | null
          tax: Json | null
          tax_fils: number | null
          taxable_fils: number | null
          total_fils: number | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          voided_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaces_invoice_id_fkey"
            columns: ["replaces_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaces_invoice_id_fkey"
            columns: ["replaces_invoice_id"]
            isOneToOne: false
            referencedRelation: "management_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      management_missing_invoices: {
        Row: {
          booking_id: string | null
          booking_reference: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          credited_fils: number | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_reference: string | null
          due_fils: number | null
          invoice_excess_fils: number | null
          invoiced_fils: number | null
          last_payment_at: string | null
          reason: string | null
          received_fils: number | null
          refunded_fils: number | null
          uncovered_fils: number | null
          uncovered_payment_count: number | null
          uncredited_refund_fils: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      management_payment_ledger: {
        Row: {
          amount_fils: number | null
          booking_id: string | null
          booking_reference: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          is_simulated: boolean | null
          method: Database["public"]["Enums"]["payment_method"] | null
          note: string | null
          payment_id: string | null
          provider_reference: string | null
          recorded_at: string | null
          recorded_by_name: string | null
          reference: string | null
          refund_pending_fils: number | null
          refund_requested_fils: number | null
          refundable_fils: number | null
          refunded_fils: number | null
          service_fee_fils: number | null
          status: Database["public"]["Enums"]["payment_status"] | null
          suite_id: string | null
          suite_number: number | null
          tax_fils: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      management_price_rules: {
        Row: {
          code: string | null
          from_hour: number | null
          guest_kind: Database["public"]["Enums"]["guest_price_kind"] | null
          id: string | null
          is_active: boolean | null
          offer_fils_per_hour: number | null
          offer_percent: number | null
          priority: number | null
          regular_fils_per_hour: number | null
          season_from: string | null
          season_to: string | null
          start_from_minutes: number | null
          start_to_minutes: number | null
          to_hour: number | null
          weekdays: number[] | null
        }
        Insert: {
          code?: string | null
          from_hour?: number | null
          guest_kind?: Database["public"]["Enums"]["guest_price_kind"] | null
          id?: string | null
          is_active?: boolean | null
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number | null
          regular_fils_per_hour?: number | null
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          weekdays?: number[] | null
        }
        Update: {
          code?: string | null
          from_hour?: number | null
          guest_kind?: Database["public"]["Enums"]["guest_price_kind"] | null
          id?: string | null
          is_active?: boolean | null
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number | null
          regular_fils_per_hour?: number | null
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          weekdays?: number[] | null
        }
        Relationships: []
      }
      management_refund_ledger: {
        Row: {
          amount_fils: number | null
          booking_id: string | null
          booking_reference: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          is_automatic: boolean | null
          is_simulated: boolean | null
          payment_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          provider_reference: string | null
          reason: string | null
          reference: string | null
          refund_id: string | null
          requested_at: string | null
          requested_by_name: string | null
          settled_at: string | null
          state: string | null
          suite_id: string | null
          suite_number: number | null
          tax_fils: number | null
          withdrawal_reason: string | null
          withdrawn_at: string | null
          withdrawn_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "management_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "management_payment_ledger"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      management_suite_inventory: {
        Row: {
          bookings_today: number | null
          current_state: string | null
          display_name: string | null
          has_history: boolean | null
          holds_today: number | null
          id: string | null
          internal_note: string | null
          is_active: boolean | null
          next_booking_at: string | null
          priority: number | null
          retired_at: string | null
          retired_by_name: string | null
          retirement_reason: string | null
          status: Database["public"]["Enums"]["suite_status"] | null
          suite_number: number | null
          upcoming_bookings: number | null
        }
        Insert: {
          bookings_today?: never
          current_state?: never
          display_name?: string | null
          has_history?: never
          holds_today?: never
          id?: string | null
          internal_note?: string | null
          is_active?: boolean | null
          next_booking_at?: never
          priority?: number | null
          retired_at?: string | null
          retired_by_name?: never
          retirement_reason?: string | null
          status?: Database["public"]["Enums"]["suite_status"] | null
          suite_number?: number | null
          upcoming_bookings?: never
        }
        Update: {
          bookings_today?: never
          current_state?: never
          display_name?: string | null
          has_history?: never
          holds_today?: never
          id?: string | null
          internal_note?: string | null
          is_active?: boolean | null
          next_booking_at?: never
          priority?: number | null
          retired_at?: string | null
          retired_by_name?: never
          retirement_reason?: string | null
          status?: Database["public"]["Enums"]["suite_status"] | null
          suite_number?: number | null
          upcoming_bookings?: never
        }
        Relationships: []
      }
      message_documents: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          document: Json | null
          document_updated_at: string | null
          draft_blocks: number | null
          draft_document: Json | null
          draft_preheader: string | null
          draft_subject: string | null
          draft_updated_at: string | null
          footer: string | null
          footer_design: Json | null
          has_draft: boolean | null
          header_design: Json | null
          is_active: boolean | null
          is_marketing: boolean | null
          is_published: boolean | null
          key: string | null
          preheader: string | null
          published_blocks: number | null
          subject: string | null
          timing_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          document?: Json | null
          document_updated_at?: string | null
          draft_blocks?: never
          draft_document?: Json | null
          draft_preheader?: string | null
          draft_subject?: string | null
          draft_updated_at?: string | null
          footer?: string | null
          footer_design?: Json | null
          has_draft?: never
          header_design?: Json | null
          is_active?: boolean | null
          is_marketing?: boolean | null
          is_published?: never
          key?: string | null
          preheader?: string | null
          published_blocks?: never
          subject?: string | null
          timing_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          document?: Json | null
          document_updated_at?: string | null
          draft_blocks?: never
          draft_document?: Json | null
          draft_preheader?: string | null
          draft_subject?: string | null
          draft_updated_at?: string | null
          footer?: string | null
          footer_design?: Json | null
          has_draft?: never
          header_design?: Json | null
          is_active?: boolean | null
          is_marketing?: boolean | null
          is_published?: never
          key?: string | null
          preheader?: string | null
          published_blocks?: never
          subject?: string | null
          timing_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      open_alerts: {
        Row: {
          alert_id: string | null
          booking_id: string | null
          booking_reference: string | null
          detail: Json | null
          entity: string | null
          entity_id: string | null
          kind: Database["public"]["Enums"]["alert_kind"] | null
          opened_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"] | null
          suite_number: number | null
        }
        Relationships: []
      }
      public_addons: {
        Row: {
          default_quantity: number | null
          description: string | null
          eligible_max_guests: number | null
          eligible_max_hours: number | null
          eligible_min_guests: number | null
          eligible_min_hours: number | null
          id: string | null
          image_path: string | null
          is_locked: boolean | null
          is_sold_out: boolean | null
          is_taxable: boolean | null
          kind: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity: number | null
          min_quantity: number | null
          name: string | null
          offer_price_fils: number | null
          regular_price_fils: number | null
          saving_label: string | null
        }
        Insert: {
          default_quantity?: never
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string | null
          image_path?: string | null
          is_locked?: boolean | null
          is_sold_out?: never
          is_taxable?: boolean | null
          kind?: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity?: never
          min_quantity?: number | null
          name?: string | null
          offer_price_fils?: number | null
          regular_price_fils?: number | null
          saving_label?: string | null
        }
        Update: {
          default_quantity?: never
          description?: string | null
          eligible_max_guests?: number | null
          eligible_max_hours?: number | null
          eligible_min_guests?: number | null
          eligible_min_hours?: number | null
          id?: string | null
          image_path?: string | null
          is_locked?: boolean | null
          is_sold_out?: never
          is_taxable?: boolean | null
          kind?: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity?: never
          min_quantity?: number | null
          name?: string | null
          offer_price_fils?: number | null
          regular_price_fils?: number | null
          saving_label?: string | null
        }
        Relationships: []
      }
      public_booking_settings: {
        Row: {
          key: string | null
          value: Json | null
        }
        Insert: {
          key?: string | null
          value?: Json | null
        }
        Update: {
          key?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      public_price_rules: {
        Row: {
          from_hour: number | null
          guest_kind: Database["public"]["Enums"]["guest_price_kind"] | null
          id: string | null
          offer_fils_per_hour: number | null
          offer_percent: number | null
          priority: number | null
          regular_fils_per_hour: number | null
          season_from: string | null
          season_to: string | null
          start_from_minutes: number | null
          start_to_minutes: number | null
          to_hour: number | null
          weekdays: number[] | null
        }
        Insert: {
          from_hour?: number | null
          guest_kind?: Database["public"]["Enums"]["guest_price_kind"] | null
          id?: string | null
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number | null
          regular_fils_per_hour?: number | null
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          weekdays?: number[] | null
        }
        Update: {
          from_hour?: number | null
          guest_kind?: Database["public"]["Enums"]["guest_price_kind"] | null
          id?: string | null
          offer_fils_per_hour?: number | null
          offer_percent?: number | null
          priority?: number | null
          regular_fils_per_hour?: number | null
          season_from?: string | null
          season_to?: string | null
          start_from_minutes?: number | null
          start_to_minutes?: number | null
          to_hour?: number | null
          weekdays?: number[] | null
        }
        Relationships: []
      }
      reception_board: {
        Row: {
          blocked_to: string | null
          board_state: string | null
          booking_id: string | null
          booking_reference: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          cleaning_buffer_minutes: number | null
          experience_from: string | null
          experience_to: string | null
          expires_at: string | null
          guest_name: string | null
          kind: Database["public"]["Enums"]["occupancy_kind"] | null
          occupancy_id: string | null
          reason: string | null
          suite_id: string | null
          suite_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_day_summary: {
        Row: {
          active_holds: number | null
          arrivals_remaining: number | null
          bookings_today: number | null
          day_from: string | null
          day_to: string | null
          guests_expected: number | null
          suites_claimed: number | null
          suites_unavailable: number | null
        }
        Relationships: []
      }
      reception_schedule: {
        Row: {
          adults: number | null
          blocked_to: string | null
          board_state: string | null
          booking_id: string | null
          booking_reference: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          children: number | null
          cleaning_buffer_minutes: number | null
          details_unavailable: boolean | null
          experience_from: string | null
          experience_to: string | null
          expires_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          kind: Database["public"]["Enums"]["occupancy_kind"] | null
          occupancy_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          reason: string | null
          suite_id: string | null
          suite_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_detail"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_search"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "management_missing_invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "open_alerts"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "management_suite_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_occupancy_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_snapshot: {
        Row: {
          description: string | null
          key: string | null
          source_tag: string | null
          updated_at: string | null
          value: Json | null
          value_type: string | null
        }
        Insert: {
          description?: string | null
          key?: string | null
          source_tag?: string | null
          updated_at?: string | null
          value?: Json | null
          value_type?: string | null
        }
        Update: {
          description?: string | null
          key?: string | null
          source_tag?: string | null
          updated_at?: string | null
          value?: Json | null
          value_type?: string | null
        }
        Relationships: []
      }
      shift_handover: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string | null
          created_at: string | null
          handed_over_at: string | null
          shift_note_id: string | null
          shift_on: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: never
          body?: string | null
          created_at?: string | null
          handed_over_at?: string | null
          shift_note_id?: string | null
          shift_on?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: never
          body?: string | null
          created_at?: string | null
          handed_over_at?: string | null
          shift_note_id?: string | null
          shift_on?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_addons: {
        Row: {
          default_quantity: number | null
          description: string | null
          eligible_max_guests: number | null
          eligible_max_hours: number | null
          eligible_min_guests: number | null
          eligible_min_hours: number | null
          id: string | null
          image_path: string | null
          is_locked: boolean | null
          is_sold_out: boolean | null
          is_taxable: boolean | null
          kind: Database["public"]["Enums"]["addon_kind"] | null
          max_quantity: number | null
          min_quantity: number | null
          name: string | null
          offer_price_fils: number | null
          reception_note: string | null
          regular_price_fils: number | null
          saving_label: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      staff_tasks: {
        Row: {
          assigned_by: string | null
          assigned_by_name: string | null
          assigned_to: string | null
          assigned_to_name: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string | null
          due_on: string | null
          note: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_by_name?: never
          assigned_to?: string | null
          assigned_to_name?: never
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: never
          created_at?: string | null
          due_on?: string | null
          note?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_by_name?: never
          assigned_to?: string | null
          assigned_to_name?: never
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: never
          created_at?: string | null
          due_on?: string | null
          note?: string | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          age_years: number | null
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          last_signup_at: string | null
          phone_country: string | null
          phone_e164: string | null
          referrer: string | null
          salutation: Database["public"]["Enums"]["salutation"] | null
          signup_count: number | null
          source: string | null
          terms_acceptance_version: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          age_years?: never
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          last_signup_at?: string | null
          phone_country?: string | null
          phone_e164?: string | null
          referrer?: string | null
          salutation?: Database["public"]["Enums"]["salutation"] | null
          signup_count?: number | null
          source?: string | null
          terms_acceptance_version?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          age_years?: never
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          last_signup_at?: string | null
          phone_country?: string | null
          phone_e164?: string | null
          referrer?: string | null
          salutation?: Database["public"]["Enums"]["salutation"] | null
          signup_count?: number | null
          source?: string | null
          terms_acceptance_version?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_shift_note: {
        Args: { p_body: string; p_shift_on: string }
        Returns: {
          body: string
          handed_over_at: string
          shift_note_id: string
          shift_on: string
        }[]
      }
      apply_email_footer_to_all: {
        Args: { p_design?: Json; p_footer: string; p_keys: string[] }
        Returns: {
          updated_count: number
        }[]
      }
      apply_email_header_to_all: {
        Args: { p_design: Json; p_keys: string[] }
        Returns: {
          updated_count: number
        }[]
      }
      archive_waitlist_entry: {
        Args: { p_entry_id: string; p_reason?: string }
        Returns: string
      }
      assign_cleaning_task: {
        Args: { p_staff_id: string; p_task_id: string }
        Returns: {
          assigned_to: string
          cleaning_task_id: string
          status: Database["public"]["Enums"]["cleaning_status"]
          suite_id: string
        }[]
      }
      assign_task: {
        Args: { p_staff_id: string; p_task_id: string }
        Returns: {
          assigned_by: string
          assigned_to: string
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
        }[]
      }
      block_suite_period: {
        Args: {
          p_from: string
          p_reason: string
          p_suite_ids: string[]
          p_to: string
        }
        Returns: {
          is_blocked: boolean
          occupancy_id: string
          suite_id: string
          suite_number: number
        }[]
      }
      booking_buffer_options: { Args: { p_booking_id: string }; Returns: Json }
      booking_move_options: {
        Args: { p_booking_id: string; p_starts_at?: string }
        Returns: {
          display_name: string
          is_available: boolean
          is_current: boolean
          status: Database["public"]["Enums"]["suite_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      booking_refunds: {
        Args: { p_booking_id: string }
        Returns: {
          amount_fils: number
          is_automatic: boolean
          is_pending: boolean
          payment_id: string
          reason: string
          reference: string
          refund_id: string
          requested_at: string
          settled_at: string
          tax_fils: number
          withdrawn_at: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: {
          booking_id: string
          released_occupancy_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      check_in_booking: {
        Args: { p_at: string; p_booking_id: string; p_reason: string }
        Returns: {
          arrived_at: string
          booking_id: string
          checked_in_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      check_out_booking: {
        Args: { p_at: string; p_booking_id: string; p_reason: string }
        Returns: {
          booking_id: string
          checked_out_at: string
          cleaning_task_id: string
          status: Database["public"]["Enums"]["booking_status"]
          suite_id: string
        }[]
      }
      checkout_revision: { Args: never; Returns: string }
      claim_staff_invitation: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      configure_suite: {
        Args: {
          p_create: boolean
          p_display_name: string
          p_internal_note: string
          p_is_active: boolean
          p_priority: number
          p_reason: string
          p_suite_id: string
          p_suite_number: number
        }
        Returns: {
          display_name: string
          is_active: boolean
          suite_id: string
          suite_number: number
        }[]
      }
      confirm_cleaning_task: {
        Args: { p_note: string; p_task_id: string }
        Returns: {
          cleaning_task_id: string
          confirmed_at: string
          confirmed_by: string
          status: Database["public"]["Enums"]["cleaning_status"]
          suite_id: string
        }[]
      }
      confirm_refund_return: {
        Args: { p_reason: string; p_reference: string; p_refund_id: string }
        Returns: {
          booking_id: string
          refund_id: string
        }[]
      }
      count_available_suites: {
        Args: {
          p_buffer_minutes: number
          p_duration_hours: number
          p_starts_at: string[]
        }
        Returns: {
          reduced_by_demand: boolean
          remaining: number
          starts_at: string
        }[]
      }
      count_reschedule_suites: {
        Args: {
          p_booking_id: string
          p_duration_minutes: number
          p_starts_at: string[]
        }
        Returns: {
          reduced_by_demand: boolean
          remaining: number
          starts_at: string
        }[]
      }
      create_customer: {
        Args: {
          p_date_of_birth: string
          p_email: string
          p_first_name: string
          p_internal_note: string
          p_last_name: string
          p_phone_country: string
          p_phone_e164: string
          p_reason: string
          p_salutation: Database["public"]["Enums"]["salutation"]
        }
        Returns: {
          customer_id: string
          reference: string
        }[]
      }
      create_reception_booking: {
        Args: {
          p_acceptance: Json
          p_addons: Json
          p_adults: number
          p_buffer_minutes: number
          p_child_ages: number[]
          p_date_of_birth: string
          p_duration_hours: number
          p_email: string
          p_first_name: string
          p_internal_note: string
          p_is_complimentary: boolean
          p_last_name: string
          p_personal_request: string
          p_phone_country: string
          p_phone_e164: string
          p_price: Json
          p_reason: string
          p_salutation: Database["public"]["Enums"]["salutation"]
          p_source: Database["public"]["Enums"]["booking_source"]
          p_starts_at: string
        }
        Returns: {
          booking_id: string
          reference: string
          suite_id: string
          suite_number: number
        }[]
      }
      create_reception_booking_paid: {
        Args: {
          p_acceptance: Json
          p_addons: Json
          p_adults: number
          p_buffer_minutes: number
          p_child_ages: number[]
          p_customer_id?: string
          p_date_of_birth: string
          p_duration_hours: number
          p_email: string
          p_first_name: string
          p_internal_note: string
          p_is_complimentary: boolean
          p_last_name: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_personal_request: string
          p_phone_country: string
          p_phone_e164: string
          p_price: Json
          p_reason: string
          p_salutation: Database["public"]["Enums"]["salutation"]
          p_source: Database["public"]["Enums"]["booking_source"]
          p_starts_at: string
          p_suite_id?: string
        }
        Returns: {
          booking_id: string
          reference: string
          suite_id: string
          suite_number: number
        }[]
      }
      create_reception_booking_selected: {
        Args: {
          p_acceptance: Json
          p_addons: Json
          p_adults: number
          p_buffer_minutes: number
          p_child_ages: number[]
          p_customer_id?: string
          p_date_of_birth: string
          p_duration_hours: number
          p_email: string
          p_first_name: string
          p_internal_note: string
          p_is_complimentary: boolean
          p_last_name: string
          p_personal_request: string
          p_phone_country: string
          p_phone_e164: string
          p_price: Json
          p_reason: string
          p_salutation: Database["public"]["Enums"]["salutation"]
          p_source: Database["public"]["Enums"]["booking_source"]
          p_starts_at: string
          p_suite_id?: string
        }
        Returns: {
          booking_id: string
          reference: string
          suite_id: string
          suite_number: number
        }[]
      }
      create_task: {
        Args: {
          p_assigned_to: string
          p_due_on: string
          p_note: string
          p_priority: Database["public"]["Enums"]["task_priority"]
          p_title: string
        }
        Returns: {
          assigned_to: string
          due_on: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          title: string
        }[]
      }
      create_waitlist_entry_manual: {
        Args: {
          p_date_of_birth: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone_country: string
          p_phone_e164: string
          p_reason?: string
          p_salutation: Database["public"]["Enums"]["salutation"]
        }
        Returns: Database["public"]["CompositeTypes"]["waitlist_submission_result"]
        SetofOptions: {
          from: "*"
          to: "waitlist_submission_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_customer: {
        Args: { p_customer_id: string; p_reason: string }
        Returns: {
          customer_id: string
          reference: string
        }[]
      }
      delete_staff_member: {
        Args: { p_reason?: string; p_staff_id: string }
        Returns: Database["public"]["CompositeTypes"]["staff_deletion_result"]
        SetofOptions: {
          from: "*"
          to: "staff_deletion_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_suite: {
        Args: { p_reason: string; p_suite_id: string }
        Returns: {
          deleted_at: string
          suite_id: string
          suite_number: number
        }[]
      }
      erase_waitlist_entry: {
        Args: { p_entry_id: string; p_reason?: string }
        Returns: undefined
      }
      extend_booking: {
        Args: {
          p_booking_id: string
          p_extra_minutes: number
          p_reason: string
        }
        Returns: {
          blocked_to: string
          booking_id: string
          experience_from: string
          experience_to: string
          occupancy_id: string
        }[]
      }
      generate_checkout_coupons: {
        Args: {
          p_batch_name?: string
          p_codes: string[]
          p_reason?: string
          p_template: Json
        }
        Returns: {
          batch_id: string
          code: string
          promo_code_id: string
        }[]
      }
      grant_staff_permission: {
        Args: {
          p_permission: Database["public"]["Enums"]["named_permission"]
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          granted_at: string
          granted_by: string
          permission: Database["public"]["Enums"]["named_permission"]
          staff_email: string
          staff_id: string
        }[]
      }
      guest_document: {
        Args: {
          p_document_id: string
          p_receipt_token: string
          p_valid_days: number
        }
        Returns: Json
      }
      guest_payment_for_verification: {
        Args: { p_payment_id: string; p_token: string }
        Returns: Json
      }
      guest_receipt: {
        Args: { p_receipt_token: string; p_valid_days: number }
        Returns: Json
      }
      hand_over_shift: {
        Args: { p_note_id: string }
        Returns: {
          handed_over_at: string
          shift_note_id: string
          shift_on: string
        }[]
      }
      hold_suite: {
        Args: {
          p_buffer_minutes: number
          p_duration_hours: number
          p_hold_minutes: number
          p_starts_at: string
        }
        Returns: {
          expires_at: string
          occupancy_id: string
          suite_id: string
        }[]
      }
      invite_staff_member: {
        Args: {
          p_email: string
          p_full_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: string
      }
      issue_invoice: {
        Args: { p_bill_to?: Json; p_booking_id: string }
        Returns: {
          addons_fils: number
          bill_to: Json
          booking_id: string
          currency: string
          customer_id: string
          discount_fils: number
          id: string
          invoice_number: string
          is_test: boolean
          issued_at: string
          issued_by: string | null
          issuer: Json
          lines: Json
          overrun_fils: number
          paid_fils: number
          payments: Json
          replaces_invoice_id: string | null
          sequence_no: number
          service_fee_fils: number
          subtotal_fils: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          total_fils: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      load_checkout_progress: { Args: { p_token: string }; Returns: Json }
      mark_late_arrival: {
        Args: { p_booking_id: string; p_minutes: number; p_reason: string }
        Returns: {
          booking_id: string
          late_arrival_minutes: number
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      mark_no_show: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: {
          booking_id: string
          released_occupancy_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      message_document_for_send: {
        Args: { p_key: string }
        Returns: {
          document: Json
          footer: string
          footer_design: Json
          header_design: Json
          is_active: boolean
          is_marketing: boolean
          preheader: string
          subject: string
        }[]
      }
      move_booking: {
        Args: {
          p_allow_unavailable: boolean
          p_booking_id: string
          p_reason: string
          p_starts_at: string
          p_suite_id: string
        }
        Returns: {
          booking_id: string
          experience_from: string
          experience_to: string
          occupancy_id: string
          status: Database["public"]["Enums"]["booking_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      open_alert: {
        Args: {
          p_detail: Json
          p_entity: string
          p_entity_id: string
          p_kind: Database["public"]["Enums"]["alert_kind"]
          p_severity: Database["public"]["Enums"]["alert_severity"]
        }
        Returns: {
          alert_id: string
          entity: string
          entity_id: string
          is_new: boolean
          kind: Database["public"]["Enums"]["alert_kind"]
          opened_at: string
          severity: Database["public"]["Enums"]["alert_severity"]
        }[]
      }
      override_booking_buffer: {
        Args: {
          p_booking_id: string
          p_buffer_minutes: number
          p_reason: string
        }
        Returns: {
          blocked_to: string
          booking_id: string
          cleaning_buffer_minutes: number
          occupancy_id: string
        }[]
      }
      payment_message_context: { Args: { p_payment_id: string }; Returns: Json }
      prepare_guest_payment: {
        Args: {
          p_currency: string
          p_quote: Json
          p_request_id: string
          p_revision: string
          p_simulated: boolean
          p_token: string
        }
        Returns: Json
      }
      preview_block_impact: {
        Args: { p_from: string; p_suite_ids: string[]; p_to: string }
        Returns: {
          blocked_from: string
          blocked_to: string
          booking_id: string
          booking_reference: string
          booking_status: Database["public"]["Enums"]["booking_status"]
          experience_from: string
          experience_to: string
          expires_at: string
          occupancy_id: string
          occupancy_kind: Database["public"]["Enums"]["occupancy_kind"]
          suite_id: string
          suite_number: number
        }[]
      }
      publish_cms_page: {
        Args: { p_label?: string; p_slug: string }
        Returns: {
          draft_data: Json
          published_at: string | null
          published_by: string | null
          published_data: Json | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cms_content"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_message_template: {
        Args: { p_key: string }
        Returns: {
          has_draft: boolean
          published_at: string
          published_blocks: number
          template_key: string
        }[]
      }
      queue_message: {
        Args: {
          p_body: string
          p_booking_id: string
          p_channel: Database["public"]["Enums"]["message_channel"]
          p_customer_id: string
          p_subject: string
          p_template_key: string
          p_to_address: string
        }
        Returns: {
          channel: Database["public"]["Enums"]["message_channel"]
          is_marketing: boolean
          message_id: string
          status: Database["public"]["Enums"]["message_status"]
          template_key: string
          to_address: string
        }[]
      }
      reception_booking_activity: {
        Args: { p_id: string }
        Returns: {
          action: string
          actor_name: string
          event_id: number
          occurred_at: string
          status: string
        }[]
      }
      reception_booking_audit: {
        Args: { p_id: string }
        Returns: {
          action: string
          actor_name: string
          event_id: number
          occurred_at: string
          reason: string
        }[]
      }
      reception_booking_change_reasons: {
        Args: { p_id: string }
        Returns: {
          action: string
          actor_name: string
          event_id: number
          occurred_at: string
          reason: string
        }[]
      }
      reception_booking_suites: {
        Args: { p_duration_hours: number; p_starts_at: string }
        Returns: {
          available: boolean
          id: string
          suite_number: number
        }[]
      }
      reception_customers: {
        Args: { p_id?: string; p_search?: string }
        Returns: {
          date_of_birth: string
          email: string
          first_name: string
          id: string
          is_blocked: boolean
          last_name: string
          phone_country: string
          phone_e164: string
          salutation: Database["public"]["Enums"]["salutation"]
        }[]
      }
      record_arrival: {
        Args: { p_arrived_at: string; p_booking_id: string; p_reason: string }
        Returns: {
          arrived_at: string
          booking_id: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      record_booking_payment: {
        Args: {
          p_amount_fils: number
          p_booking_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note: string
          p_provider_reference: string
          p_reason: string
        }
        Returns: {
          amount_fils: number
          booking_comped: boolean
          booking_id: string
          payment_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          recorded_at: string
          recorded_by: string
        }[]
      }
      record_message_attempt: {
        Args: {
          p_error: string
          p_message_id: string
          p_provider_message_id: string
          p_status: Database["public"]["Enums"]["message_status"]
        }
        Returns: {
          attempt_count: number
          failed_at: string
          last_attempt_at: string
          message_id: string
          sent_at: string
          status: Database["public"]["Enums"]["message_status"]
        }[]
      }
      record_overrun: {
        Args: {
          p_actual_end: string
          p_adult_rate_fils: number
          p_booking_id: string
          p_child_rate_fils: number
          p_rate_source: string
          p_reason: string
        }
        Returns: {
          adults: number
          booking_id: string
          chargeable_increments: number
          chargeable_minutes: number
          children: number
          increment_minutes: number
          overrun_fils: number
          overrun_minutes: number
          rate_source: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      record_refund: {
        Args: { p_amount_fils: number; p_payment_id: string; p_reason: string }
        Returns: {
          amount_fils: number
          booking_id: string
          is_pending: boolean
          payment_amount_fils: number
          payment_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          refund_id: string
          refunded_total_fils: number
        }[]
      }
      regenerate_invoice: {
        Args: { p_bill_to?: Json; p_invoice_id: string; p_reason: string }
        Returns: {
          addons_fils: number
          bill_to: Json
          booking_id: string
          currency: string
          customer_id: string
          discount_fils: number
          id: string
          invoice_number: string
          is_test: boolean
          issued_at: string
          issued_by: string | null
          issuer: Json
          lines: Json
          overrun_fils: number
          paid_fils: number
          payments: Json
          replaces_invoice_id: string | null
          sequence_no: number
          service_fee_fils: number
          subtotal_fils: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          total_fils: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      release_guest_hold: { Args: { p_token: string }; Returns: undefined }
      release_suite_block: {
        Args: { p_occupancy_id: string; p_reason: string }
        Returns: {
          occupancy_id: string
          status: Database["public"]["Enums"]["occupancy_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      refund_payment_and_cancel_booking: {
        Args: {
          p_amount_fils: number
          p_payment_id: string
          p_reason: string
          p_request_key: string
        }
        Returns: {
          booking_cancelled: boolean
          refund_id: string
        }[]
      }
      request_payment_refund: {
        Args: {
          p_amount_fils: number
          p_payment_id: string
          p_reason: string
          p_request_key: string
        }
        Returns: string
      }
      reschedule_booking: {
        Args: {
          p_booking_id: string
          p_duration_hours?: number
          p_duration_minutes?: number
          p_reason: string
          p_starts_at: string
        }
        Returns: {
          booking_id: string
          experience_from: string
          experience_to: string
          occupancy_id: string
          status: Database["public"]["Enums"]["booking_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      resend_staff_invitation: {
        Args: { p_invitation_id: string; p_reason?: string }
        Returns: Database["public"]["CompositeTypes"]["staff_invitation_resend_result"]
        SetofOptions: {
          from: "*"
          to: "staff_invitation_resend_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_guest_hold: {
        Args: {
          p_buffer_minutes: number
          p_duration_hours: number
          p_expected_settings: Json
          p_hold_minutes: number
          p_starts_at: string
          p_token: string
        }
        Returns: string
      }
      reset_cms_page: {
        Args: { p_reason?: string; p_slug: string }
        Returns: {
          draft_data: Json
          published_at: string | null
          published_by: string | null
          published_data: Json | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cms_content"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_message_template: {
        Args: { p_key: string }
        Returns: {
          cleared_document: boolean
          cleared_draft: boolean
          reset_at: string
          template_key: string
        }[]
      }
      resolve_alert: {
        Args: { p_alert_id: string; p_note: string }
        Returns: {
          alert_id: string
          kind: Database["public"]["Enums"]["alert_kind"]
          resolved_at: string
          resolved_by: string
        }[]
      }
      restore_cms_version: {
        Args: { p_slug: string; p_version_id: number }
        Returns: {
          draft_data: Json
          published_at: string | null
          published_by: string | null
          published_data: Json | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cms_content"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_waitlist_entry: {
        Args: { p_entry_id: string; p_reason?: string }
        Returns: undefined
      }
      retire_suite: {
        Args: { p_reason: string; p_suite_id: string }
        Returns: {
          retired_at: string
          status: Database["public"]["Enums"]["suite_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      return_suite_to_service: {
        Args: { p_reason: string; p_suite_id: string }
        Returns: {
          is_active: boolean
          status: Database["public"]["Enums"]["suite_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      revoke_receipt_link: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: number
      }
      revoke_staff_invitation: {
        Args: { p_invitation_id: string; p_reason?: string }
        Returns: undefined
      }
      revoke_staff_permission: {
        Args: {
          p_permission: Database["public"]["Enums"]["named_permission"]
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          permission: Database["public"]["Enums"]["named_permission"]
          revoked_grant_at: string
          staff_email: string
          staff_id: string
        }[]
      }
      save_catalogue_item: {
        Args: { p_expected: Json; p_kind: string; p_values: Json }
        Returns: string
      }
      save_checkout_coupon: {
        Args: { p_expected_updated_at?: string; p_input: Json }
        Returns: string
      }
      save_checkout_progress: {
        Args: {
          p_abandoned_minutes: number
          p_capture_customer?: boolean
          p_consent: Json
          p_progress: Json
          p_token: string
        }
        Returns: undefined
      }
      save_cms_draft: {
        Args: { p_data: Json; p_slug: string }
        Returns: {
          draft_data: Json
          published_at: string | null
          published_by: string | null
          published_data: Json | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cms_content"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_message_template_draft: {
        Args: {
          p_document: Json
          p_key: string
          p_preheader: string
          p_subject: string
        }
        Returns: {
          draft_blocks: number
          draft_saved_at: string
          has_document: boolean
          has_draft: boolean
          template_key: string
        }[]
      }
      save_suite_configuration: {
        Args: {
          p_create: boolean
          p_display_name: string
          p_is_active: boolean
          p_reason: string
          p_suite_id: string
          p_suite_number: number
        }
        Returns: {
          display_name: string
          is_active: boolean
          suite_id: string
          suite_number: number
        }[]
      }
      save_suite_setup: {
        Args: {
          p_create: boolean
          p_display_name: string
          p_internal_note: string
          p_priority: number
          p_reason: string
          p_suite_id: string
          p_suite_number: number
        }
        Returns: {
          display_name: string
          is_active: boolean
          suite_id: string
          suite_number: number
        }[]
      }
      set_addon: {
        Args: {
          p_available_from: string
          p_available_to: string
          p_default_quantity: number
          p_description: string
          p_id: string
          p_image_path: string
          p_inventory: number
          p_is_active: boolean
          p_is_locked: boolean
          p_is_taxable: boolean
          p_kind: Database["public"]["Enums"]["addon_kind"]
          p_max_quantity: number
          p_min_quantity: number
          p_name: string
          p_offer_price_fils: number
          p_reason: string
          p_reception_note: string
          p_regular_price_fils: number
          p_saving_label: string
          p_sort_order: number
        }
        Returns: {
          addon_id: string
          default_quantity: number
          inventory: number
          is_active: boolean
          is_locked: boolean
          kind: Database["public"]["Enums"]["addon_kind"]
          max_quantity: number
          min_quantity: number
          name: string
          offer_price_fils: number
          regular_price_fils: number
          saving_label: string
          sort_order: number
          was_created: boolean
        }[]
      }
      set_customer_warning: {
        Args: {
          p_customer_id: string
          p_is_blocked: boolean
          p_reason: string
          p_warning_note: string
        }
        Returns: {
          customer_id: string
          is_blocked: boolean
          warning_note: string
        }[]
      }
      set_manual_booking_price: {
        Args: { p_booking_id: string; p_reason: string; p_total_fils: number }
        Returns: {
          booking_id: string
          previous_total_fils: number
          reference: string
          total_fils: number
        }[]
      }
      set_message_template: {
        Args: {
          p_body: string
          p_channel: Database["public"]["Enums"]["message_channel"]
          p_is_active: boolean
          p_key: string
          p_reason: string
          p_subject: string
          p_timing_minutes: number
        }
        Returns: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          is_active: boolean
          is_marketing: boolean
          subject: string
          template_key: string
          timing_minutes: number
          updated_at: string
          was_created: boolean
        }[]
      }
      set_overstay_charges: {
        Args: { p_reason: string; p_value: Json }
        Returns: {
          amount_fils: number
          rate_source: string
        }[]
      }
      set_payment_method_fee: {
        Args: {
          p_customer_label: string
          p_is_enabled: boolean
          p_method: Database["public"]["Enums"]["payment_method"]
          p_percent: number
          p_reason: string
        }
        Returns: {
          customer_label: string
          is_enabled: boolean
          method: Database["public"]["Enums"]["payment_method"]
          percent: number
          updated_at: string
        }[]
      }
      set_price_tier: {
        Args: {
          p_code: string
          p_from_hour: number
          p_guest_kind: Database["public"]["Enums"]["guest_price_kind"]
          p_id: string
          p_is_active: boolean
          p_offer_fils_per_hour: number
          p_offer_percent: number
          p_priority: number
          p_reason: string
          p_regular_fils_per_hour: number
          p_season_from: string
          p_season_to: string
          p_start_from_minutes: number
          p_start_to_minutes: number
          p_to_hour: number
          p_weekdays: number[]
        }
        Returns: {
          code: string
          from_hour: number
          guest_kind: Database["public"]["Enums"]["guest_price_kind"]
          is_active: boolean
          offer_fils_per_hour: number
          offer_percent: number
          price_rule_id: string
          priority: number
          regular_fils_per_hour: number
          to_hour: number
          was_created: boolean
        }[]
      }
      set_promo_code: {
        Args: {
          p_addon_ids: string[]
          p_amount_fils: number
          p_code: string
          p_id: string
          p_is_active: boolean
          p_is_combinable: boolean
          p_kind: Database["public"]["Enums"]["promo_kind"]
          p_max_uses: number
          p_per_customer_limit: number
          p_percent: number
          p_reason: string
          p_valid_from: string
          p_valid_to: string
        }
        Returns: {
          amount_fils: number
          code: string
          is_active: boolean
          is_combinable: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          max_uses: number
          per_customer_limit: number
          percent: number
          promo_code_id: string
          target_addon_ids: string[]
          used_count: number
          valid_from: string
          valid_to: string
          was_created: boolean
        }[]
      }
      set_setting: {
        Args: { p_key: string; p_reason: string; p_value: Json }
        Returns: {
          setting_key: string
          setting_value: Json
          source_tag: string
          updated_at: string
          value_type: string
        }[]
      }
      set_settings_group: {
        Args: { p_changes: Json; p_reason: string }
        Returns: {
          saved_count: number
        }[]
      }
      set_staff_active: {
        Args: { p_is_active: boolean; p_reason?: string; p_staff_id: string }
        Returns: undefined
      }
      set_staff_role: {
        Args: {
          p_reason?: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_staff_id: string
        }
        Returns: undefined
      }
      set_suite_details: {
        Args: {
          p_internal_note: string
          p_priority: number
          p_reason: string
          p_suite_id: string
        }
        Returns: {
          internal_note: string
          previous_priority: number
          priority: number
          suite_id: string
          suite_number: number
        }[]
      }
      set_suite_status: {
        Args: {
          p_reason: string
          p_status: Database["public"]["Enums"]["suite_status"]
          p_suite_id: string
        }
        Returns: {
          previous_status: Database["public"]["Enums"]["suite_status"]
          status: Database["public"]["Enums"]["suite_status"]
          suite_id: string
          suite_number: number
        }[]
      }
      settle_payment_event: {
        Args: {
          p_amount_fils: number
          p_currency: string
          p_event_id: string
          p_outcome: string
          p_payload: Json
          p_payment_id: string
          p_provider: string
          p_signature_verified: boolean
        }
        Returns: Json
      }
      start_cleaning_task: {
        Args: { p_task_id: string }
        Returns: {
          cleaning_task_id: string
          started_at: string
          status: Database["public"]["Enums"]["cleaning_status"]
          suite_id: string
        }[]
      }
      submit_waitlist_entry: {
        Args: {
          p_date_of_birth: string
          p_email: string
          p_first_name: string
          p_is_spam?: boolean
          p_last_name: string
          p_phone_country: string
          p_phone_e164: string
          p_referrer?: string
          p_salutation: Database["public"]["Enums"]["salutation"]
          p_source?: string
          p_terms_text?: string
          p_terms_version?: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_medium?: string
          p_utm_source?: string
          p_utm_term?: string
        }
        Returns: Database["public"]["CompositeTypes"]["waitlist_submission_result"]
        SetofOptions: {
          from: "*"
          to: "waitlist_submission_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suite_booked_dates: {
        Args: { p_from: string; p_suite_id: string; p_to: string }
        Returns: {
          booked_on: string
          bookings: number
        }[]
      }
      update_booking_details: {
        Args: {
          p_booking_id: string
          p_internal_note: string
          p_personal_request: string
          p_reason: string
        }
        Returns: {
          booking_id: string
          internal_note: string
          personal_request: string
        }[]
      }
      update_customer: {
        Args: {
          p_customer_id: string
          p_date_of_birth: string
          p_first_name: string
          p_internal_note: string
          p_last_name: string
          p_phone_country: string
          p_phone_e164: string
          p_reason: string
          p_salutation: Database["public"]["Enums"]["salutation"]
        }
        Returns: {
          customer_id: string
          reference: string
        }[]
      }
      update_task_status: {
        Args: {
          p_note: string
          p_status: Database["public"]["Enums"]["task_status"]
          p_task_id: string
        }
        Returns: {
          completed_at: string
          completed_by: string
          note: string
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
        }[]
      }
      void_booking_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          amount_fils: number
          booking_id: string
          payment_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          previous_status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      void_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: {
          addons_fils: number
          bill_to: Json
          booking_id: string
          currency: string
          customer_id: string
          discount_fils: number
          id: string
          invoice_number: string
          is_test: boolean
          issued_at: string
          issued_by: string | null
          issuer: Json
          lines: Json
          overrun_fils: number
          paid_fils: number
          payments: Json
          replaces_invoice_id: string | null
          sequence_no: number
          service_fee_fils: number
          subtotal_fils: number
          supply_date: string
          tax: Json
          tax_fils: number
          taxable_fils: number
          total_fils: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      withdraw_refund_request: {
        Args: { p_reason: string; p_refund_id: string }
        Returns: {
          booking_id: string
          payment_id: string
          refund_id: string
        }[]
      }
      work_item_activity: {
        Args: { p_id: string; p_kind: string }
        Returns: {
          action: string
          actor_name: string
          assignee_name: string
          event_id: number
          occurred_at: string
          status: string
        }[]
      }
    }
    Enums: {
      addon_kind: "rental" | "consumable" | "per_person" | "per_booking"
      alert_kind:
        | "hold_expiring"
        | "payment_without_suite"
        | "payment_failed"
        | "message_failed"
        | "arrival_overdue"
        | "checkin_overdue"
        | "cleaning_unconfirmed"
        | "upcoming_conflict"
        | "refund_pending"
        | "manual_review_pending"
      alert_severity: "critical" | "warning" | "info"
      booking_source:
        | "online"
        | "walk_in"
        | "telephone"
        | "manual"
        | "complimentary"
      booking_status:
        | "draft"
        | "held"
        | "awaiting_payment"
        | "payment_failed"
        | "hold_expired"
        | "awaiting_recovery"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "rescheduled"
        | "cancelled"
        | "no_show"
        | "abandoned"
      cleaning_status: "pending" | "in_progress" | "confirmed"
      cms_status: "draft" | "published"
      consent_origin: "waitlist_form" | "console_manual" | "booking_form"
      guest_kind: "adult" | "child"
      guest_price_kind: "adult" | "child"
      message_channel: "email" | "whatsapp"
      message_status: "queued" | "sent" | "failed" | "cancelled"
      named_permission:
        | "view_confidential_figures"
        | "override_suite_allocation"
        | "manual_price_change"
        | "correct_customer_record"
      occupancy_kind: "hold" | "booking" | "block" | "maintenance"
      occupancy_status: "active" | "converted" | "expired" | "released"
      payment_method:
        | "cash"
        | "card_terminal"
        | "payment_link"
        | "online"
        | "complimentary"
      payment_status:
        | "open"
        | "pending"
        | "paid"
        | "partially_refunded"
        | "fully_refunded"
        | "failed"
        | "cancelled"
        | "manual_review"
      promo_kind: "fixed" | "percent" | "addon_free"
      salutation: "mr" | "ms"
      staff_role: "reception" | "management"
      suite_status:
        | "available"
        | "checkout_hold"
        | "booked"
        | "checked_in"
        | "cleaning"
        | "blocked"
        | "maintenance"
        | "not_ready"
        | "out_of_service"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "cancelled"
      waitlist_submission_status: "created" | "already_registered"
    }
    CompositeTypes: {
      staff_deletion_result: {
        staff_id: string | null
        email: string | null
        full_name: string | null
        role: Database["public"]["Enums"]["staff_role"] | null
        was_active: boolean | null
        invitations_revoked: number | null
        deleted_at: string | null
      }
      staff_invitation_resend_result: {
        invitation_id: string | null
        email: string | null
        full_name: string | null
        role: Database["public"]["Enums"]["staff_role"] | null
        expires_at: string | null
        resend_count: number | null
        last_resent_at: string | null
        was_expired: boolean | null
      }
      waitlist_submission_result: {
        status: Database["public"]["Enums"]["waitlist_submission_status"] | null
        entry_id: string | null
        submitted_at: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      addon_kind: ["rental", "consumable", "per_person", "per_booking"],
      alert_kind: [
        "hold_expiring",
        "payment_without_suite",
        "payment_failed",
        "message_failed",
        "arrival_overdue",
        "checkin_overdue",
        "cleaning_unconfirmed",
        "upcoming_conflict",
        "refund_pending",
        "manual_review_pending",
      ],
      alert_severity: ["critical", "warning", "info"],
      booking_source: [
        "online",
        "walk_in",
        "telephone",
        "manual",
        "complimentary",
      ],
      booking_status: [
        "draft",
        "held",
        "awaiting_payment",
        "payment_failed",
        "hold_expired",
        "awaiting_recovery",
        "confirmed",
        "checked_in",
        "completed",
        "rescheduled",
        "cancelled",
        "no_show",
        "abandoned",
      ],
      cleaning_status: ["pending", "in_progress", "confirmed"],
      cms_status: ["draft", "published"],
      consent_origin: ["waitlist_form", "console_manual", "booking_form"],
      guest_kind: ["adult", "child"],
      guest_price_kind: ["adult", "child"],
      message_channel: ["email", "whatsapp"],
      message_status: ["queued", "sent", "failed", "cancelled"],
      named_permission: [
        "view_confidential_figures",
        "override_suite_allocation",
        "manual_price_change",
        "correct_customer_record",
      ],
      occupancy_kind: ["hold", "booking", "block", "maintenance"],
      occupancy_status: ["active", "converted", "expired", "released"],
      payment_method: [
        "cash",
        "card_terminal",
        "payment_link",
        "online",
        "complimentary",
      ],
      payment_status: [
        "open",
        "pending",
        "paid",
        "partially_refunded",
        "fully_refunded",
        "failed",
        "cancelled",
        "manual_review",
      ],
      promo_kind: ["fixed", "percent", "addon_free"],
      salutation: ["mr", "ms"],
      staff_role: ["reception", "management"],
      suite_status: [
        "available",
        "checkout_hold",
        "booked",
        "checked_in",
        "cleaning",
        "blocked",
        "maintenance",
        "not_ready",
        "out_of_service",
      ],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      waitlist_submission_status: ["created", "already_registered"],
    },
  },
} as const

