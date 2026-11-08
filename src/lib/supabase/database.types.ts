export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          business_id: string
          code: string
          group: string
          id: string
          name: string
          nature: string
          system: boolean
        }
        Insert: {
          business_id: string
          code: string
          group: string
          id: string
          name: string
          nature: string
          system?: boolean
        }
        Update: {
          business_id?: string
          code?: string
          group?: string
          id?: string
          name?: string
          nature?: string
          system?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          bucket: string
          business_id: string
          created_at: string
          id: string
          mime: string
          name: string
          path: string
          ref_id: string | null
          ref_type: string | null
          size: number
        }
        Insert: {
          bucket: string
          business_id: string
          created_at?: string
          id?: string
          mime: string
          name: string
          path: string
          ref_id?: string | null
          ref_type?: string | null
          size: number
        }
        Update: {
          bucket?: string
          business_id?: string
          created_at?: string
          id?: string
          mime?: string
          name?: string
          path?: string
          ref_id?: string | null
          ref_type?: string | null
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          at: string
          business_id: string
          detail: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor: string
          at?: string
          business_id: string
          detail?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          business_id?: string
          detail?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string
          bank_account: string
          bank_name: string
          city: string
          created_at: string
          email: string
          gstin: string
          id: string
          ifsc: string
          invoice_template: string
          legal_name: string
          logo_data_url: string | null
          name: string
          pan: string
          phone: string
          pincode: string
          prefixes: Json
          signature_data_url: string | null
          state_code: string
          tax_scheme: string
          tcs_pct: number
          terms: string
          upi_id: string
          valuation: string
        }
        Insert: {
          address?: string
          bank_account?: string
          bank_name?: string
          city?: string
          created_at?: string
          email?: string
          gstin?: string
          id?: string
          ifsc?: string
          invoice_template?: string
          legal_name?: string
          logo_data_url?: string | null
          name: string
          pan?: string
          phone?: string
          pincode?: string
          prefixes?: Json
          signature_data_url?: string | null
          state_code: string
          tax_scheme?: string
          tcs_pct?: number
          terms?: string
          upi_id?: string
          valuation?: string
        }
        Update: {
          address?: string
          bank_account?: string
          bank_name?: string
          city?: string
          created_at?: string
          email?: string
          gstin?: string
          id?: string
          ifsc?: string
          invoice_template?: string
          legal_name?: string
          logo_data_url?: string | null
          name?: string
          pan?: string
          phone?: string
          pincode?: string
          prefixes?: Json
          signature_data_url?: string | null
          state_code?: string
          tax_scheme?: string
          tcs_pct?: number
          terms?: string
          upi_id?: string
          valuation?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_sequences: {
        Row: {
          business_id: string
          fy: number
          last: number
          series: string
        }
        Insert: {
          business_id: string
          fy: number
          last?: number
          series: string
        }
        Update: {
          business_id?: string
          fy?: number
          last?: number
          series?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string
          amount: number
          attachment_name: string | null
          attachment_path: string | null
          business_id: string
          category: string
          created_at: string
          date: string
          gst_amount: number
          id: string
          notes: string
          number: string
          pay_from_account_id: string
          vendor: string
        }
        Insert: {
          account_id: string
          amount: number
          attachment_name?: string | null
          attachment_path?: string | null
          business_id: string
          category: string
          created_at?: string
          date: string
          gst_amount?: number
          id: string
          notes?: string
          number: string
          pay_from_account_id: string
          vendor?: string
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_name?: string | null
          attachment_path?: string | null
          business_id?: string
          category?: string
          created_at?: string
          date?: string
          gst_amount?: number
          id?: string
          notes?: string
          number?: string
          pay_from_account_id?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_account_id_fkey"
            columns: ["business_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_business_id_pay_from_account_id_fkey"
            columns: ["business_id", "pay_from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          business_id: string
          cleared: Json
          created_at: string
          date: string
          id: string
          narration: string
          number: string
          ref_id: string | null
          ref_type: string | null
          seq: number
          voucher_type: string
        }
        Insert: {
          business_id: string
          cleared?: Json
          created_at?: string
          date: string
          id: string
          narration?: string
          number: string
          ref_id?: string | null
          ref_type?: string | null
          seq?: never
          voucher_type: string
        }
        Update: {
          business_id?: string
          cleared?: Json
          created_at?: string
          date?: string
          id?: string
          narration?: string
          number?: string
          ref_id?: string | null
          ref_type?: string | null
          seq?: never
          voucher_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          business_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          line_no: number
          narration: string | null
          party_id: string | null
        }
        Insert: {
          account_id: string
          business_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          line_no?: number
          narration?: string | null
          party_id?: string | null
        }
        Update: {
          account_id?: string
          business_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          line_no?: number
          narration?: string | null
          party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_business_id_account_id_fkey"
            columns: ["business_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "journal_lines_business_id_entry_id_fkey"
            columns: ["business_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "journal_lines_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "journal_lines_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "journal_lines_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          email: string
          id?: string
          name?: string
          role: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          active: boolean
          address: string
          business_id: string
          created_at: string
          credit_days: number
          credit_limit: number
          email: string
          gstin: string
          id: string
          name: string
          opening_balance: number
          phone: string
          price_list: string
          state_code: string
          type: string
        }
        Insert: {
          active?: boolean
          address?: string
          business_id: string
          created_at?: string
          credit_days?: number
          credit_limit?: number
          email?: string
          gstin?: string
          id?: string
          name: string
          opening_balance?: number
          phone?: string
          price_list?: string
          state_code: string
          type: string
        }
        Update: {
          active?: boolean
          address?: string
          business_id?: string
          created_at?: string
          credit_days?: number
          credit_limit?: number
          email?: string
          gstin?: string
          id?: string
          name?: string
          opening_balance?: number
          phone?: string
          price_list?: string
          state_code?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          business_id: string
          doc_id: string
          doc_kind: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          business_id: string
          doc_id: string
          doc_kind: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          business_id?: string
          doc_id?: string
          doc_kind?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_payment_id_fkey"
            columns: ["business_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string
          amount: number
          business_id: string
          created_at: string
          date: string
          direction: string
          id: string
          mode: string
          notes: string
          number: string
          party_id: string
          party_name: string
          reference: string
        }
        Insert: {
          account_id: string
          amount: number
          business_id: string
          created_at?: string
          date: string
          direction: string
          id: string
          mode: string
          notes?: string
          number: string
          party_id: string
          party_name?: string
          reference?: string
        }
        Update: {
          account_id?: string
          amount?: number
          business_id?: string
          created_at?: string
          date?: string
          direction?: string
          id?: string
          mode?: string
          notes?: string
          number?: string
          party_id?: string
          party_name?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_account_id_fkey"
            columns: ["business_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payments_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string
          business_id: string
          id: string
          name: string
          product_id: string
          sale_price: number | null
          sku: string
        }
        Insert: {
          barcode?: string
          business_id: string
          id?: string
          name: string
          product_id: string
          sale_price?: number | null
          sku?: string
        }
        Update: {
          barcode?: string
          business_id?: string
          id?: string
          name?: string
          product_id?: string
          sale_price?: number | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_business_id_product_id_fkey"
            columns: ["business_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          alt_factor: number | null
          alt_unit: string | null
          barcode: string
          brand: string
          business_id: string
          category: string
          cess_pct: number
          created_at: string
          gst_rate: number
          hsn: string
          id: string
          image_url: string | null
          is_service: boolean
          mrp: number
          name: string
          opening_stock: number
          purchase_price: number
          reorder_level: number
          sale_price: number
          sku: string
          track_batch: boolean
          track_serial: boolean
          unit: string
          wholesale_price: number
        }
        Insert: {
          active?: boolean
          alt_factor?: number | null
          alt_unit?: string | null
          barcode?: string
          brand?: string
          business_id: string
          category?: string
          cess_pct?: number
          created_at?: string
          gst_rate?: number
          hsn?: string
          id?: string
          image_url?: string | null
          is_service?: boolean
          mrp?: number
          name: string
          opening_stock?: number
          purchase_price?: number
          reorder_level?: number
          sale_price?: number
          sku?: string
          track_batch?: boolean
          track_serial?: boolean
          unit?: string
          wholesale_price?: number
        }
        Update: {
          active?: boolean
          alt_factor?: number | null
          alt_unit?: string | null
          barcode?: string
          brand?: string
          business_id?: string
          category?: string
          cess_pct?: number
          created_at?: string
          gst_rate?: number
          hsn?: string
          id?: string
          image_url?: string | null
          is_service?: boolean
          mrp?: number
          name?: string
          opening_stock?: number
          purchase_price?: number
          reorder_level?: number
          sale_price?: number
          sku?: string
          track_batch?: boolean
          track_serial?: boolean
          unit?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_documents: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          business_id: string
          created_at: string
          created_by: string | null
          date: string
          due_date: string | null
          einvoice: Json
          eway_bill_no: string | null
          id: string
          notes: string
          number: string
          paid: number
          party_gstin: string
          party_id: string | null
          party_name: string
          place_of_supply: string
          ref_doc_id: string | null
          reverse_charge: boolean
          status: string
          supplier_invoice_no: string | null
          supply: string
          tcs_pct: number
          terms: string
          totals: Json
          type: string
          warehouse_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          date: string
          due_date?: string | null
          einvoice?: Json
          eway_bill_no?: string | null
          id: string
          notes?: string
          number: string
          paid?: number
          party_gstin?: string
          party_id?: string | null
          party_name?: string
          place_of_supply: string
          ref_doc_id?: string | null
          reverse_charge?: boolean
          status: string
          supplier_invoice_no?: string | null
          supply: string
          tcs_pct?: number
          terms?: string
          totals: Json
          type: string
          warehouse_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          due_date?: string | null
          einvoice?: Json
          eway_bill_no?: string | null
          id?: string
          notes?: string
          number?: string
          paid?: number
          party_gstin?: string
          party_id?: string | null
          party_name?: string
          place_of_supply?: string
          ref_doc_id?: string | null
          reverse_charge?: boolean
          status?: string
          supplier_invoice_no?: string | null
          supply?: string
          tcs_pct?: number
          terms?: string
          totals?: Json
          type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_documents_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          batch_no: string | null
          business_id: string
          cess_pct: number
          discount_pct: number
          document_id: string
          expiry: string | null
          gst_rate: number
          hsn: string
          id: string
          line_no: number
          name: string
          product_id: string
          qty: number
          rate: number
          serials: string[] | null
          unit: string
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_no?: string | null
          business_id: string
          cess_pct?: number
          discount_pct?: number
          document_id: string
          expiry?: string | null
          gst_rate?: number
          hsn?: string
          id?: string
          line_no: number
          name: string
          product_id: string
          qty: number
          rate: number
          serials?: string[] | null
          unit: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_no?: string | null
          business_id?: string
          cess_pct?: number
          discount_pct?: number
          document_id?: string
          expiry?: string | null
          gst_rate?: number
          hsn?: string
          id?: string
          line_no?: number
          name?: string
          product_id?: string
          qty?: number
          rate?: number
          serials?: string[] | null
          unit?: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_business_id_document_id_fkey"
            columns: ["business_id", "document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_business_id_product_id_fkey"
            columns: ["business_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_business_id_variant_id_fkey"
            columns: ["business_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      sales_documents: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          business_id: string
          created_at: string
          created_by: string | null
          date: string
          due_date: string | null
          einvoice: Json
          eway_bill_no: string | null
          id: string
          notes: string
          number: string
          paid: number
          party_gstin: string
          party_id: string | null
          party_name: string
          place_of_supply: string
          ref_doc_id: string | null
          reverse_charge: boolean
          status: string
          supply: string
          tcs_pct: number
          terms: string
          totals: Json
          type: string
          warehouse_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          date: string
          due_date?: string | null
          einvoice?: Json
          eway_bill_no?: string | null
          id: string
          notes?: string
          number: string
          paid?: number
          party_gstin?: string
          party_id?: string | null
          party_name?: string
          place_of_supply: string
          ref_doc_id?: string | null
          reverse_charge?: boolean
          status: string
          supply: string
          tcs_pct?: number
          terms?: string
          totals: Json
          type: string
          warehouse_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          due_date?: string | null
          einvoice?: Json
          eway_bill_no?: string | null
          id?: string
          notes?: string
          number?: string
          paid?: number
          party_gstin?: string
          party_id?: string | null
          party_name?: string
          place_of_supply?: string
          ref_doc_id?: string | null
          reverse_charge?: boolean
          status?: string
          supply?: string
          tcs_pct?: number
          terms?: string
          totals?: Json
          type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_documents_business_id_party_id_fkey"
            columns: ["business_id", "party_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_documents_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      sales_items: {
        Row: {
          batch_no: string | null
          business_id: string
          cess_pct: number
          discount_pct: number
          document_id: string
          expiry: string | null
          gst_rate: number
          hsn: string
          id: string
          line_no: number
          name: string
          product_id: string
          qty: number
          rate: number
          serials: string[] | null
          unit: string
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          batch_no?: string | null
          business_id: string
          cess_pct?: number
          discount_pct?: number
          document_id: string
          expiry?: string | null
          gst_rate?: number
          hsn?: string
          id?: string
          line_no: number
          name: string
          product_id: string
          qty: number
          rate: number
          serials?: string[] | null
          unit: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          batch_no?: string | null
          business_id?: string
          cess_pct?: number
          discount_pct?: number
          document_id?: string
          expiry?: string | null
          gst_rate?: number
          hsn?: string
          id?: string
          line_no?: number
          name?: string
          product_id?: string
          qty?: number
          rate?: number
          serials?: string[] | null
          unit?: string
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_business_id_document_id_fkey"
            columns: ["business_id", "document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_business_id_product_id_fkey"
            columns: ["business_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_items_business_id_variant_id_fkey"
            columns: ["business_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "sales_items_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_no: string
          business_id: string
          expiry: string | null
          id: string
          product_id: string
          qty: number
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_no: string
          business_id: string
          expiry?: string | null
          id?: string
          product_id: string
          qty?: number
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_no?: string
          business_id?: string
          expiry?: string | null
          id?: string
          product_id?: string
          qty?: number
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_business_id_product_id_fkey"
            columns: ["business_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "stock_batches_business_id_variant_id_fkey"
            columns: ["business_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "stock_batches_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_no: string | null
          business_id: string
          created_at: string
          date: string
          expiry: string | null
          id: string
          product_id: string
          qty: number
          rate: number
          reason: string | null
          ref_id: string | null
          ref_number: string | null
          ref_type: string | null
          seq: number
          type: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_no?: string | null
          business_id: string
          created_at?: string
          date: string
          expiry?: string | null
          id: string
          product_id: string
          qty: number
          rate?: number
          reason?: string | null
          ref_id?: string | null
          ref_number?: string | null
          ref_type?: string | null
          seq?: never
          type: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_no?: string | null
          business_id?: string
          created_at?: string
          date?: string
          expiry?: string | null
          id?: string
          product_id?: string
          qty?: number
          rate?: number
          reason?: string | null
          ref_id?: string | null
          ref_number?: string | null
          ref_type?: string | null
          seq?: never
          type?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_business_id_product_id_fkey"
            columns: ["business_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_business_id_variant_id_fkey"
            columns: ["business_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_business_id_warehouse_id_fkey"
            columns: ["business_id", "warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      units: {
        Row: {
          business_id: string
          code: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          code: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          code?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string
          business_id: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          address?: string
          business_id: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          address?: string
          business_id?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customers: {
        Row: {
          active: boolean | null
          address: string | null
          business_id: string | null
          created_at: string | null
          credit_days: number | null
          credit_limit: number | null
          email: string | null
          gstin: string | null
          id: string | null
          name: string | null
          opening_balance: number | null
          phone: string | null
          price_list: string | null
          state_code: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string | null
          name?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_list?: string | null
          state_code?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string | null
          name?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_list?: string | null
          state_code?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          business_id: string | null
          created_at: string | null
          credit_days: number | null
          credit_limit: number | null
          email: string | null
          gstin: string | null
          id: string | null
          name: string | null
          opening_balance: number | null
          phone: string | null
          price_list: string | null
          state_code: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string | null
          name?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_list?: string | null
          state_code?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          business_id?: string | null
          created_at?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gstin?: string | null
          id?: string | null
          name?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_list?: string | null
          state_code?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_invites: { Args: never; Returns: undefined }
      commit_changes: {
        Args: { p_business: string; p_payload: Json }
        Returns: undefined
      }
      create_business: {
        Args: { p_gstin: string; p_name: string; p_state_code: string }
        Returns: string
      }
      has_permission: {
        Args: { p_action: string; p_business: string; p_module: string }
        Returns: boolean
      }
      invite_member: {
        Args: {
          p_business: string
          p_email: string
          p_name: string
          p_role: string
        }
        Returns: string
      }
      my_business_ids: { Args: never; Returns: string[] }
      my_role: { Args: { p_business: string }; Returns: string }
      set_member_active: {
        Args: { p_active: boolean; p_business: string; p_member: string }
        Returns: undefined
      }
      set_member_role: {
        Args: { p_business: string; p_member: string; p_role: string }
        Returns: undefined
      }
      storage_business: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
