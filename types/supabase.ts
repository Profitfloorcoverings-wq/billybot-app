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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      chat_file_analysis: {
        Row: {
          chat_file_id: string
          confidence: number | null
          contains_dimensions: boolean | null
          contains_measurements: boolean | null
          contains_prices: boolean | null
          contains_room_names: boolean | null
          contains_text: boolean | null
          conversation_id: string
          created_at: string
          document_kind: string | null
          file_type: string
          id: string
          notes: string | null
          suggested_next_action: string | null
        }
        Insert: {
          chat_file_id: string
          confidence?: number | null
          contains_dimensions?: boolean | null
          contains_measurements?: boolean | null
          contains_prices?: boolean | null
          contains_room_names?: boolean | null
          contains_text?: boolean | null
          conversation_id: string
          created_at?: string
          document_kind?: string | null
          file_type: string
          id?: string
          notes?: string | null
          suggested_next_action?: string | null
        }
        Update: {
          chat_file_id?: string
          confidence?: number | null
          contains_dimensions?: boolean | null
          contains_measurements?: boolean | null
          contains_prices?: boolean | null
          contains_room_names?: boolean | null
          contains_text?: boolean | null
          conversation_id?: string
          created_at?: string
          document_kind?: string | null
          file_type?: string
          id?: string
          notes?: string | null
          suggested_next_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_file_analysis_chat_file_id_fkey"
            columns: ["chat_file_id"]
            isOneToOne: false
            referencedRelation: "chat_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_file_analysis_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_files: {
        Row: {
          conversation_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime_type: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime_type: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          accounting_system: string | null
          address_line1: string | null
          address_line2: string | null
          business_name: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          downloaded_app: boolean
          downloaded_app_at: string | null
          downloaded_app_platform: string | null
          email: string | null
          email2: string | null
          free_user: boolean | null
          has_edited_pricing_settings: boolean
          has_mobile_app: boolean
          has_uploaded_price_list: boolean
          id: string
          is_onboarded: boolean | null
          onboarding_last_step: string | null
          onboarding_stopped: boolean
          onboarding_updated_at: string | null
          parent_client_id: string | null
          phone: string | null
          postcode: string | null
          quote_no: number | null
          quotes_used: number | null
          stripe_current_period_end: string | null
          stripe_customer_id: string | null
          stripe_id: string | null
          stripe_plan_billing: string | null
          stripe_plan_tier: string | null
          stripe_price_id: string | null
          stripe_status: string | null
          stripe_subscription_id: string | null
          stripe_updated_at: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          user_role: string
        }
        Insert: {
          accounting_system?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          downloaded_app?: boolean
          downloaded_app_at?: string | null
          downloaded_app_platform?: string | null
          email?: string | null
          email2?: string | null
          free_user?: boolean | null
          has_edited_pricing_settings?: boolean
          has_mobile_app?: boolean
          has_uploaded_price_list?: boolean
          id?: string
          is_onboarded?: boolean | null
          onboarding_last_step?: string | null
          onboarding_stopped?: boolean
          onboarding_updated_at?: string | null
          parent_client_id?: string | null
          phone?: string | null
          postcode?: string | null
          quote_no?: number | null
          quotes_used?: number | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_id?: string | null
          stripe_plan_billing?: string | null
          stripe_plan_tier?: string | null
          stripe_price_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          stripe_updated_at?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          user_role?: string
        }
        Update: {
          accounting_system?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          downloaded_app?: boolean
          downloaded_app_at?: string | null
          downloaded_app_platform?: string | null
          email?: string | null
          email2?: string | null
          free_user?: boolean | null
          has_edited_pricing_settings?: boolean
          has_mobile_app?: boolean
          has_uploaded_price_list?: boolean
          id?: string
          is_onboarded?: boolean | null
          onboarding_last_step?: string | null
          onboarding_stopped?: boolean
          onboarding_updated_at?: string | null
          parent_client_id?: string | null
          phone?: string | null
          postcode?: string | null
          quote_no?: number | null
          quotes_used?: number | null
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_id?: string | null
          stripe_plan_billing?: string | null
          stripe_plan_tier?: string | null
          stripe_price_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          stripe_updated_at?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge: {
        Row: {
          content: string | null
          created_at: string
          id: number
          topic: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          topic?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          topic?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          profile_id: string
          task_state: Database["public"]["Enums"]["conversation_task_state"]
          title: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          profile_id: string
          task_state?: Database["public"]["Enums"]["conversation_task_state"]
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          profile_id?: string
          task_state?: Database["public"]["Enums"]["conversation_task_state"]
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          customer_name: string | null
          email: string | null
          id: string
          mobile: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          customer_name?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          customer_name?: string | null
          email?: string | null
          id?: string
          mobile?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      demo_users: {
        Row: {
          created_at: string
          demo_used: boolean | null
          id: string
          job_text: string | null
          phone: string | null
          quote_preview: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          demo_used?: boolean | null
          id?: string
          job_text?: string | null
          phone?: string | null
          quote_preview?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          demo_used?: boolean | null
          id?: string
          job_text?: string | null
          phone?: string | null
          quote_preview?: string | null
          source?: string | null
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          business_id: string
          cancellation_reason: string | null
          confirmation_data: Json | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          end_datetime: string
          entry_type: string
          id: string
          job_address: string | null
          job_id: string | null
          notes: string | null
          postcode: string | null
          start_datetime: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          cancellation_reason?: string | null
          confirmation_data?: Json | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_datetime: string
          entry_type?: string
          id?: string
          job_address?: string | null
          job_id?: string | null
          notes?: string | null
          postcode?: string | null
          start_datetime: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancellation_reason?: string | null
          confirmation_data?: Json | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_datetime?: string
          entry_type?: string
          id?: string
          job_address?: string | null
          job_id?: string | null
          notes?: string | null
          postcode?: string | null
          start_datetime?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_fitters: {
        Row: {
          diary_entry_id: string
          id: string
          notified_at: string | null
          team_member_id: string
        }
        Insert: {
          diary_entry_id: string
          id?: string
          notified_at?: string | null
          team_member_id: string
        }
        Update: {
          diary_entry_id?: string
          id?: string
          notified_at?: string | null
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_fitters_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_fitters_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token_enc: string | null
          client_id: string
          created_at: string
          email_address: string
          email_connection_status: string | null
          expires_at: string | null
          gmail_history_id: string | null
          gmail_last_push_at: string | null
          gmail_watch_expires_at: string | null
          id: string
          last_error: string | null
          last_error_at: string | null
          last_success_at: string | null
          ms_last_push_at: string | null
          ms_subscription_expires_at: string | null
          ms_subscription_id: string | null
          provider: string
          refresh_token_enc: string | null
          scopes: string[]
          send_enabled: boolean
          status: string
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          client_id: string
          created_at?: string
          email_address: string
          email_connection_status?: string | null
          expires_at?: string | null
          gmail_history_id?: string | null
          gmail_last_push_at?: string | null
          gmail_watch_expires_at?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          ms_last_push_at?: string | null
          ms_subscription_expires_at?: string | null
          ms_subscription_id?: string | null
          provider: string
          refresh_token_enc?: string | null
          scopes?: string[]
          send_enabled?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          client_id?: string
          created_at?: string
          email_address?: string
          email_connection_status?: string | null
          expires_at?: string | null
          gmail_history_id?: string | null
          gmail_last_push_at?: string | null
          gmail_watch_expires_at?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_success_at?: string | null
          ms_last_push_at?: string | null
          ms_subscription_expires_at?: string | null
          ms_subscription_id?: string | null
          provider?: string
          refresh_token_enc?: string | null
          scopes?: string[]
          send_enabled?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_conversations: {
        Row: {
          address_city: string | null
          address_first_line: string | null
          address_postcode: string | null
          ai_context: string | null
          client_id: string | null
          conversation_history: string | null
          created_at: string
          customer_email: string | null
          first_name: string | null
          id: number
          Original_enquiry: string | null
          phone_number: string | null
          second_name: string | null
          Subject: string | null
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_first_line?: string | null
          address_postcode?: string | null
          ai_context?: string | null
          client_id?: string | null
          conversation_history?: string | null
          created_at?: string
          customer_email?: string | null
          first_name?: string | null
          id?: number
          Original_enquiry?: string | null
          phone_number?: string | null
          second_name?: string | null
          Subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_first_line?: string | null
          address_postcode?: string | null
          ai_context?: string | null
          client_id?: string | null
          conversation_history?: string | null
          created_at?: string
          customer_email?: string | null
          first_name?: string | null
          id?: number
          Original_enquiry?: string | null
          phone_number?: string | null
          second_name?: string | null
          Subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          account_id: string
          attachments: Json | null
          attempts: number
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          client_id: string
          created_at: string
          direction: string | null
          error: string | null
          from_email: string | null
          id: string
          last_error: string | null
          meta: Json
          "meta.triage": Json | null
          processed_at: string | null
          processing_started_at: string | null
          provider: string
          provider_message_id: string | null
          provider_thread_id: string | null
          queue_status: string
          received_at: string | null
          recommended_route: string | null
          status: string
          subject: string | null
          to_emails: string[] | null
        }
        Insert: {
          account_id: string
          attachments?: Json | null
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          client_id: string
          created_at?: string
          direction?: string | null
          error?: string | null
          from_email?: string | null
          id?: string
          last_error?: string | null
          meta?: Json
          "meta.triage"?: Json | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider: string
          provider_message_id?: string | null
          provider_thread_id?: string | null
          queue_status?: string
          received_at?: string | null
          recommended_route?: string | null
          status?: string
          subject?: string | null
          to_emails?: string[] | null
        }
        Update: {
          account_id?: string
          attachments?: Json | null
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          client_id?: string
          created_at?: string
          direction?: string | null
          error?: string | null
          from_email?: string | null
          id?: string
          last_error?: string | null
          meta?: Json
          "meta.triage"?: Json | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_thread_id?: string | null
          queue_status?: string
          received_at?: string | null
          recommended_route?: string | null
          status?: string
          subject?: string | null
          to_emails?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_index: {
        Row: {
          cc_emails: string | null
          created_at: string
          from_email: string | null
          from_name: string | null
          has_attachment: boolean | null
          id: string
          labels: string[] | null
          project_tag: string | null
          provider_msg_id: string | null
          subject: string | null
          summary: string | null
          thread_id: string | null
          to_emails: string[] | null
          ts: string | null
        }
        Insert: {
          cc_emails?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          has_attachment?: boolean | null
          id: string
          labels?: string[] | null
          project_tag?: string | null
          provider_msg_id?: string | null
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          to_emails?: string[] | null
          ts?: string | null
        }
        Update: {
          cc_emails?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          has_attachment?: boolean | null
          id?: string
          labels?: string[] | null
          project_tag?: string | null
          provider_msg_id?: string | null
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          to_emails?: string[] | null
          ts?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          client_id: string | null
          conversation_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_reply: boolean | null
          email_event_id: string | null
          end_date: string | null
          fitter_1: string | null
          fitter_2: string | null
          fitter_3: string | null
          fitter_4: string | null
          fitter_5: string | null
          fitter_6: string | null
          fitter_7: string | null
          id: string
          job_details: string | null
          job_sheet_ref: string | null
          job_sheet_url: string | null
          job_thread_id: string | null
          last_activity_at: string
          metadata: Json | null
          method_statement_ref: string | null
          method_statement_url: string | null
          outbound_email_body: string | null
          outbound_email_subject: string | null
          postcode: string | null
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          quote_ref: string | null
          quote_url: string | null
          risk_assessment_ref: string | null
          risk_assessment_url: string | null
          site_address: string | null
          start_date: string | null
          status: string
          thread_type: string
          title: string | null
        }
        Insert: {
          client_id?: string | null
          conversation_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_reply?: boolean | null
          email_event_id?: string | null
          end_date?: string | null
          fitter_1?: string | null
          fitter_2?: string | null
          fitter_3?: string | null
          fitter_4?: string | null
          fitter_5?: string | null
          fitter_6?: string | null
          fitter_7?: string | null
          id?: string
          job_details?: string | null
          job_sheet_ref?: string | null
          job_sheet_url?: string | null
          job_thread_id?: string | null
          last_activity_at?: string
          metadata?: Json | null
          method_statement_ref?: string | null
          method_statement_url?: string | null
          outbound_email_body?: string | null
          outbound_email_subject?: string | null
          postcode?: string | null
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          quote_ref?: string | null
          quote_url?: string | null
          risk_assessment_ref?: string | null
          risk_assessment_url?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          thread_type?: string
          title?: string | null
        }
        Update: {
          client_id?: string | null
          conversation_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_reply?: boolean | null
          email_event_id?: string | null
          end_date?: string | null
          fitter_1?: string | null
          fitter_2?: string | null
          fitter_3?: string | null
          fitter_4?: string | null
          fitter_5?: string | null
          fitter_6?: string | null
          fitter_7?: string | null
          id?: string
          job_details?: string | null
          job_sheet_ref?: string | null
          job_sheet_url?: string | null
          job_thread_id?: string | null
          last_activity_at?: string
          metadata?: Json | null
          method_statement_ref?: string | null
          method_statement_url?: string | null
          outbound_email_body?: string | null
          outbound_email_subject?: string | null
          postcode?: string | null
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          quote_ref?: string | null
          quote_url?: string | null
          risk_assessment_ref?: string | null
          risk_assessment_url?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          thread_type?: string
          title?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          id: string
          key: string
          profile_id: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          profile_id: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          profile_id?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          file_type: string | null
          file_url: string | null
          id: string
          job_sheet_reference: string | null
          metadata: Json | null
          method_statement_ref: string | null
          profile_id: string | null
          quote_reference: string | null
          risk_assessment_ref: string | null
          role: string | null
          type: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          job_sheet_reference?: string | null
          metadata?: Json | null
          method_statement_ref?: string | null
          profile_id?: string | null
          quote_reference?: string | null
          risk_assessment_ref?: string | null
          role?: string | null
          type?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          job_sheet_reference?: string | null
          metadata?: Json | null
          method_statement_ref?: string | null
          profile_id?: string | null
          quote_reference?: string | null
          risk_assessment_ref?: string | null
          role?: string | null
          type?: string | null
        }
        Relationships: []
      }
      onboarding_sessions: {
        Row: {
          answers_json: Json
          contact: string | null
          created_at: string
          expires_at: string | null
          id: string
          Services: string | null
          status: Database["public"]["Enums"]["session_status"]
          step: number
          stored_base: string | null
        }
        Insert: {
          answers_json?: Json
          contact?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          Services?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          step?: number
          stored_base?: string | null
        }
        Update: {
          answers_json?: Json
          contact?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          Services?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          step?: number
          stored_base?: string | null
        }
        Relationships: []
      }
      pricing_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          effective_from: string
          profile_id: string
          profile_json: Json
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string | null
          vat_registered: boolean | null
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          profile_id?: string
          profile_json?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string | null
          vat_registered?: boolean | null
          version?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          profile_id?: string
          profile_json?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string | null
          vat_registered?: boolean | null
          version?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          breakpoints_json: Json | null
          created_at: string | null
          day_rate_per_fitter: number
          furniture_removal: number
          lab_carpet_tiles_m2: string | null
          lab_ceramic_tiles_m2: number
          lab_commercial_carpet_m2: number
          lab_commercial_vinyl_m2: number
          lab_coved_m: number
          lab_domestic_carpet_m2: number
          lab_domestic_vinyl_m2: number
          lab_door_bars_each: string
          lab_gripper_m: string
          lab_latex_m2: number
          lab_lvt_m2: number
          lab_matting_m2: string
          lab_nosings_m: string
          lab_ply_m2: number
          lab_safety_m2: number
          lab_uplift_m2: string
          lab_wall_cladding_m2: number
          markup_carpet_tiles_type: string | null
          markup_carpet_tiles_value: number
          markup_commercial_carpet_type: string | null
          markup_commercial_carpet_value: number
          markup_commercial_vinyl_type: string | null
          markup_commercial_vinyl_value: number
          markup_domestic_carpet_type: string | null
          markup_domestic_carpet_value: number
          markup_domestic_vinyl_type: string | null
          markup_domestic_vinyl_value: number
          markup_lvt_type: string | null
          markup_lvt_value: number
          markup_wall_cladding_type: string | null
          markup_wall_cladding_value: number
          mat_adhesive_m2: number
          mat_carpet_tiles_m2: string | null
          mat_ceramic_tiles_m2: number
          mat_commercial_carpet_m2: number
          mat_commercial_vinyl_m2: number
          mat_coved_m2: number
          mat_domestic_carpet_m2: number
          mat_domestic_vinyl_m2: number
          mat_door_bars_each: number
          mat_gripper: string
          mat_latex_m2: string
          mat_lvt_m2: number
          mat_matting_m2: number
          mat_nosings_m: number
          mat_ply_m2: number
          mat_safety_m2: number
          mat_underlay: number
          mat_uplift_m2: number
          mat_wall_cladding_m2: number
          mat_weld: number
          min_labour_charge: number
          profile_id: string
          separate_labour: boolean
          service_carpet_tiles: boolean
          service_commercial_carpet: boolean
          service_commercial_vinyl: boolean
          service_domestic_carpet: boolean
          service_domestic_vinyl: boolean
          service_lvt: boolean
          service_wall_cladding: boolean
          small_job_charge: number
          updated_at: string | null
          vat_registered: boolean
          waste_disposal: string
        }
        Insert: {
          breakpoints_json?: Json | null
          created_at?: string | null
          day_rate_per_fitter?: number
          furniture_removal?: number
          lab_carpet_tiles_m2?: string | null
          lab_ceramic_tiles_m2?: number
          lab_commercial_carpet_m2?: number
          lab_commercial_vinyl_m2?: number
          lab_coved_m?: number
          lab_domestic_carpet_m2?: number
          lab_domestic_vinyl_m2?: number
          lab_door_bars_each?: string
          lab_gripper_m?: string
          lab_latex_m2?: number
          lab_lvt_m2?: number
          lab_matting_m2?: string
          lab_nosings_m?: string
          lab_ply_m2?: number
          lab_safety_m2?: number
          lab_uplift_m2?: string
          lab_wall_cladding_m2?: number
          markup_carpet_tiles_type?: string | null
          markup_carpet_tiles_value?: number
          markup_commercial_carpet_type?: string | null
          markup_commercial_carpet_value?: number
          markup_commercial_vinyl_type?: string | null
          markup_commercial_vinyl_value?: number
          markup_domestic_carpet_type?: string | null
          markup_domestic_carpet_value?: number
          markup_domestic_vinyl_type?: string | null
          markup_domestic_vinyl_value?: number
          markup_lvt_type?: string | null
          markup_lvt_value?: number
          markup_wall_cladding_type?: string | null
          markup_wall_cladding_value?: number
          mat_adhesive_m2?: number
          mat_carpet_tiles_m2?: string | null
          mat_ceramic_tiles_m2?: number
          mat_commercial_carpet_m2?: number
          mat_commercial_vinyl_m2?: number
          mat_coved_m2?: number
          mat_domestic_carpet_m2?: number
          mat_domestic_vinyl_m2?: number
          mat_door_bars_each?: number
          mat_gripper?: string
          mat_latex_m2?: string
          mat_lvt_m2?: number
          mat_matting_m2?: number
          mat_nosings_m?: number
          mat_ply_m2?: number
          mat_safety_m2?: number
          mat_underlay?: number
          mat_uplift_m2?: number
          mat_wall_cladding_m2?: number
          mat_weld?: number
          min_labour_charge?: number
          profile_id: string
          separate_labour?: boolean
          service_carpet_tiles?: boolean
          service_commercial_carpet?: boolean
          service_commercial_vinyl?: boolean
          service_domestic_carpet?: boolean
          service_domestic_vinyl?: boolean
          service_lvt?: boolean
          service_wall_cladding?: boolean
          small_job_charge?: number
          updated_at?: string | null
          vat_registered?: boolean
          waste_disposal?: string
        }
        Update: {
          breakpoints_json?: Json | null
          created_at?: string | null
          day_rate_per_fitter?: number
          furniture_removal?: number
          lab_carpet_tiles_m2?: string | null
          lab_ceramic_tiles_m2?: number
          lab_commercial_carpet_m2?: number
          lab_commercial_vinyl_m2?: number
          lab_coved_m?: number
          lab_domestic_carpet_m2?: number
          lab_domestic_vinyl_m2?: number
          lab_door_bars_each?: string
          lab_gripper_m?: string
          lab_latex_m2?: number
          lab_lvt_m2?: number
          lab_matting_m2?: string
          lab_nosings_m?: string
          lab_ply_m2?: number
          lab_safety_m2?: number
          lab_uplift_m2?: string
          lab_wall_cladding_m2?: number
          markup_carpet_tiles_type?: string | null
          markup_carpet_tiles_value?: number
          markup_commercial_carpet_type?: string | null
          markup_commercial_carpet_value?: number
          markup_commercial_vinyl_type?: string | null
          markup_commercial_vinyl_value?: number
          markup_domestic_carpet_type?: string | null
          markup_domestic_carpet_value?: number
          markup_domestic_vinyl_type?: string | null
          markup_domestic_vinyl_value?: number
          markup_lvt_type?: string | null
          markup_lvt_value?: number
          markup_wall_cladding_type?: string | null
          markup_wall_cladding_value?: number
          mat_adhesive_m2?: number
          mat_carpet_tiles_m2?: string | null
          mat_ceramic_tiles_m2?: number
          mat_commercial_carpet_m2?: number
          mat_commercial_vinyl_m2?: number
          mat_coved_m2?: number
          mat_domestic_carpet_m2?: number
          mat_domestic_vinyl_m2?: number
          mat_door_bars_each?: number
          mat_gripper?: string
          mat_latex_m2?: string
          mat_lvt_m2?: number
          mat_matting_m2?: number
          mat_nosings_m?: number
          mat_ply_m2?: number
          mat_safety_m2?: number
          mat_underlay?: number
          mat_uplift_m2?: number
          mat_wall_cladding_m2?: number
          mat_weld?: number
          min_labour_charge?: number
          profile_id?: string
          separate_labour?: boolean
          service_carpet_tiles?: boolean
          service_commercial_carpet?: boolean
          service_commercial_vinyl?: boolean
          service_domestic_carpet?: boolean
          service_domestic_vinyl?: boolean
          service_lvt?: boolean
          service_wall_cladding?: boolean
          small_job_charge?: number
          updated_at?: string | null
          vat_registered?: boolean
          waste_disposal?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string | null
          platform: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_connections: {
        Row: {
          access_token: string | null
          business_hint: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          realmId: string | null
          refresh_token: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          realmId?: string | null
          refresh_token?: string | null
          state: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          realmId?: string | null
          refresh_token?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_id: string | null
          created_at: string
          customer_name: string | null
          follow_up_status: string | null
          id: string
          job_details: string | null
          job_ref: string | null
          pdf_url: string | null
          quote: string | null
          quote_reference: string | null
          quote_status: string | null
          version: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          follow_up_status?: string | null
          id?: string
          job_details?: string | null
          job_ref?: string | null
          pdf_url?: string | null
          quote?: string | null
          quote_reference?: string | null
          quote_status?: string | null
          version?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          follow_up_status?: string | null
          id?: string
          job_details?: string | null
          job_ref?: string | null
          pdf_url?: string | null
          quote?: string | null
          quote_reference?: string | null
          quote_status?: string | null
          version?: number | null
        }
        Relationships: []
      }
      rams_signatures: {
        Row: {
          created_at: string
          document_type: string
          document_url: string | null
          id: string
          job_id: string
          signature_data: string | null
          signed_at: string | null
          signer_id: string
          signer_name: string
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url?: string | null
          id?: string
          job_id: string
          signature_data?: string | null
          signed_at?: string | null
          signer_id: string
          signer_name: string
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string | null
          id?: string
          job_id?: string
          signature_data?: string | null
          signed_at?: string | null
          signer_id?: string
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rams_signatures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rams_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sage_connections: {
        Row: {
          access_token: string | null
          business_hint: string | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_prices: {
        Row: {
          brand: string | null
          category: string | null
          client_id: string | null
          created_at: string
          cut_price: number | null
          expense_account_id: string | null
          id: number
          income_account_id: string | null
          "ItemRef.value": string | null
          last_synced_at: string | null
          m2_price: number | null
          price: number | null
          price_per_m: number | null
          price_source: string | null
          product_id: string | null
          product_name: string | null
          purchase_account_code: string | null
          purchase_ledger_account_id: string | null
          roll_price: number | null
          sales_account_code: string | null
          sales_ledger_account_id: string | null
          supplier_name: string | null
          type: string | null
          uom: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          cut_price?: number | null
          expense_account_id?: string | null
          id?: number
          income_account_id?: string | null
          "ItemRef.value"?: string | null
          last_synced_at?: string | null
          m2_price?: number | null
          price?: number | null
          price_per_m?: number | null
          price_source?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_account_code?: string | null
          purchase_ledger_account_id?: string | null
          roll_price?: number | null
          sales_account_code?: string | null
          sales_ledger_account_id?: string | null
          supplier_name?: string | null
          type?: string | null
          uom?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          cut_price?: number | null
          expense_account_id?: string | null
          id?: number
          income_account_id?: string | null
          "ItemRef.value"?: string | null
          last_synced_at?: string | null
          m2_price?: number | null
          price?: number | null
          price_per_m?: number | null
          price_source?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_account_code?: string | null
          purchase_ledger_account_id?: string | null
          roll_price?: number | null
          sales_account_code?: string | null
          sales_ledger_account_id?: string | null
          supplier_name?: string | null
          type?: string | null
          uom?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          business_id: string
          created_at: string
          expires_at: string
          id: string
          invite_email: string
          invite_token: string
          invited_by: string
          name: string
          role: string
          used_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_email: string
          invite_token?: string
          invited_by: string
          name: string
          role: string
          used_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_email?: string
          invite_token?: string
          invited_by?: string
          name?: string
          role?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          id: string
          invite_email: string
          invite_status: string
          invited_by: string
          member_id: string
          name: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          id?: string
          invite_email: string
          invite_status?: string
          invited_by: string
          member_id: string
          name?: string | null
          role: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          id?: string
          invite_email?: string
          invite_status?: string
          invited_by?: string
          member_id?: string
          name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          context: string | null
          created_at: string
          id: number
          resolved: boolean | null
          term: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: number
          resolved?: boolean | null
          term?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: number
          resolved?: boolean | null
          term?: string | null
        }
        Relationships: []
      }
      Waitlist: {
        Row: {
          created_at: string
          Email: string | null
          id: number
          Trade: string | null
        }
        Insert: {
          created_at?: string
          Email?: string | null
          id?: number
          Trade?: string | null
        }
        Update: {
          created_at?: string
          Email?: string | null
          id?: number
          Trade?: string | null
        }
        Relationships: []
      }
      xero_connections: {
        Row: {
          access_token: string | null
          business_hint: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          state: string
          tenantId: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          state: string
          tenantId?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          business_hint?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          state?: string
          tenantId?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_email_event: {
        Args: { p_id: string }
        Returns: {
          account_id: string
          attachments: Json | null
          attempts: number
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          client_id: string
          created_at: string
          direction: string | null
          error: string | null
          from_email: string | null
          id: string
          last_error: string | null
          meta: Json
          "meta.triage": Json | null
          processed_at: string | null
          processing_started_at: string | null
          provider: string
          provider_message_id: string | null
          provider_thread_id: string | null
          queue_status: string
          received_at: string | null
          recommended_route: string | null
          status: string
          subject: string | null
          to_emails: string[] | null
        }
        SetofOptions: {
          from: "*"
          to: "email_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_email_events: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          attachments: Json | null
          attempts: number
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          client_id: string
          created_at: string
          direction: string | null
          error: string | null
          from_email: string | null
          id: string
          last_error: string | null
          meta: Json
          "meta.triage": Json | null
          processed_at: string | null
          processing_started_at: string | null
          provider: string
          provider_message_id: string | null
          provider_thread_id: string | null
          queue_status: string
          received_at: string | null
          recommended_route: string | null
          status: string
          subject: string | null
          to_emails: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_email_candidates:
        | {
            Args: {
              p_account_id: string
              p_client_id: string
              p_exclude_email_event_id?: string
              p_from_email: string
              p_limit?: number
              p_provider: string
              p_provider_thread_id?: string
              p_subject: string
            }
            Returns: {
              from_email: string
              id: string
              job_id: string
              provider_thread_id: string
              received_at: string
              score: number
              snippet: string
              subject: string
              thread_id: string
            }[]
          }
        | {
            Args: {
              p_account_id: string
              p_client_id: string
              p_from_email: string
              p_limit?: number
              p_provider: string
              p_provider_thread_id?: string
              p_subject: string
            }
            Returns: {
              from_email: string
              id: string
              job_id: string
              provider_thread_id: string
              received_at: string
              score: number
              snippet: string
              subject: string
              thread_id: string
            }[]
          }
      mark_downloaded_app: { Args: { p_platform?: string }; Returns: undefined }
      mark_email_event_error: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      mark_email_event_processed: { Args: { p_id: string }; Returns: undefined }
      norm_text: { Args: { t: string }; Returns: string }
      requeue_stuck_email_events: {
        Args: { p_max_attempts?: number; p_max_minutes?: number }
        Returns: number
      }
    }
    Enums: {
      conversation_task_state:
        | "idle"
        | "building_quote"
        | "updating_quote"
        | "sending_quote"
        | "awaiting_info"
        | "locked"
        | "human_handoff"
        | "building_job_sheet"
        | "building_rams"
      ledger_system: "xero" | "sage"
      profile_status: "draft" | "active" | "archived"
      session_status: "active" | "completed" | "expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      conversation_task_state: [
        "idle",
        "building_quote",
        "updating_quote",
        "sending_quote",
        "awaiting_info",
        "locked",
        "human_handoff",
        "building_job_sheet",
        "building_rams",
      ],
      ledger_system: ["xero", "sage"],
      profile_status: ["draft", "active", "archived"],
      session_status: ["active", "completed", "expired"],
    },
  },
} as const
