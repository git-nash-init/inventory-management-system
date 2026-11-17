export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Generated from the database (Supabase MCP generate_typescript_types). Regenerate after changing the schema.
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      invoice_items: {
        Row: {
          amount: number;
          cost_price: number;
          id: string;
          invoice_id: string;
          name: string;
          price: number;
          product_id: string;
          qty: number;
          unit: string;
        };
        Insert: {
          amount: number;
          cost_price: number;
          id?: string;
          invoice_id: string;
          name: string;
          price: number;
          product_id: string;
          qty: number;
          unit: string;
        };
        Update: {
          amount?: number;
          cost_price?: number;
          id?: string;
          invoice_id?: string;
          name?: string;
          price?: number;
          product_id?: string;
          qty?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          created_at: string;
          customer_mobile: string;
          customer_name: string;
          gst_amount: number;
          gst_percent: number | null;
          id: string;
          invoice_date: string;
          number: number;
          status: string;
          subtotal: number;
          total: number;
        };
        Insert: {
          created_at?: string;
          customer_mobile?: string;
          customer_name?: string;
          gst_amount?: number;
          gst_percent?: number | null;
          id?: string;
          invoice_date?: string;
          number?: never;
          status?: string;
          subtotal?: number;
          total?: number;
        };
        Update: {
          created_at?: string;
          customer_mobile?: string;
          customer_name?: string;
          gst_amount?: number;
          gst_percent?: number | null;
          id?: string;
          invoice_date?: string;
          number?: never;
          status?: string;
          subtotal?: number;
          total?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          active: boolean;
          buy_price: number;
          created_at: string;
          id: string;
          low_stock_at: number | null;
          name: string;
          sell_price: number;
          unit: string;
        };
        Insert: {
          active?: boolean;
          buy_price?: number;
          created_at?: string;
          id?: string;
          low_stock_at?: number | null;
          name: string;
          sell_price?: number;
          unit?: string;
        };
        Update: {
          active?: boolean;
          buy_price?: number;
          created_at?: string;
          id?: string;
          low_stock_at?: number | null;
          name?: string;
          sell_price?: number;
          unit?: string;
        };
        Relationships: [];
      };
      shop: {
        Row: {
          account_no: string;
          address: string;
          bank_name: string;
          id: number;
          ifsc: string;
          name: string;
          phone: string;
          upi_id: string;
        };
        Insert: {
          account_no?: string;
          address?: string;
          bank_name?: string;
          id?: number;
          ifsc?: string;
          name?: string;
          phone?: string;
          upi_id?: string;
        };
        Update: {
          account_no?: string;
          address?: string;
          bank_name?: string;
          id?: number;
          ifsc?: string;
          name?: string;
          phone?: string;
          upi_id?: string;
        };
        Relationships: [];
      };
      stock_entries: {
        Row: {
          buy_price: number | null;
          created_at: string;
          entry_date: string;
          id: string;
          note: string;
          product_id: string;
          qty: number;
        };
        Insert: {
          buy_price?: number | null;
          created_at?: string;
          entry_date?: string;
          id?: string;
          note?: string;
          product_id: string;
          qty: number;
        };
        Update: {
          buy_price?: number | null;
          created_at?: string;
          entry_date?: string;
          id?: string;
          note?: string;
          product_id?: string;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stock_entries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_entries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      product_stock: {
        Row: {
          active: boolean | null;
          buy_price: number | null;
          created_at: string | null;
          id: string | null;
          low_stock_at: number | null;
          name: string | null;
          quantity: number | null;
          sell_price: number | null;
          stock_value: number | null;
          unit: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_stock: {
        Args: {
          p_buy_price?: number;
          p_note?: string;
          p_product: string;
          p_qty: number;
        };
        Returns: undefined;
      };
      cancel_invoice: { Args: { p_id: string }; Returns: undefined };
      create_invoice: {
        Args: {
          p_customer_mobile: string;
          p_customer_name: string;
          p_gst_percent: number;
          p_items: Json;
        };
        Returns: string;
      };
      dashboard_month: { Args: { p_month: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
