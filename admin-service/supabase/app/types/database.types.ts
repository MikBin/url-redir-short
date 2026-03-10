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
      analytics_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          destination: string
          device_type: string | null
          id: string
          ip: string | null
          link_id: string | null
          os: string | null
          path: string
          referrer: string | null
          referrer_source: string | null
          session_id: string | null
          status: number | null
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          destination: string
          device_type?: string | null
          id?: string
          ip?: string | null
          link_id?: string | null
          os?: string | null
          path: string
          referrer?: string | null
          referrer_source?: string | null
          session_id?: string | null
          status?: number | null
          timestamp: string
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          destination?: string
          device_type?: string | null
          id?: string
          ip?: string | null
          link_id?: string | null
          os?: string | null
          path?: string
          referrer?: string | null
          referrer_source?: string | null
          session_id?: string | null
          status?: number | null
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          }
        ]
      }
      links: {
        Row: {
          ab_testing: Json | null
          created_at: string
          destination: string
          domain_id: string | null
          expires_at: string | null
          hsts: Json | null
          id: string
          is_active: boolean
          max_clicks: number | null
          owner_id: string
          password_protection: Json | null
          slug: string
          targeting: Json | null
          updated_at: string
        }
        Insert: {
          ab_testing?: Json | null
          created_at?: string
          destination: string
          domain_id?: string | null
          expires_at?: string | null
          hsts?: Json | null
          id?: string
          is_active?: boolean
          max_clicks?: number | null
          owner_id: string
          password_protection?: Json | null
          slug: string
          targeting?: Json | null
          updated_at?: string
        }
        Update: {
          ab_testing?: Json | null
          created_at?: string
          destination?: string
          domain_id?: string | null
          expires_at?: string | null
          hsts?: Json | null
          id?: string
          is_active?: boolean
          max_clicks?: number | null
          owner_id?: string
          password_protection?: Json | null
          slug?: string
          targeting?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          }
        ]
      }
      domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          last_activity_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at: string
          id?: string
          last_activity_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_aggregates: {
        Row: {
          browser_breakdown: Json | null
          click_count: number
          conversion_data: Json | null
          country_breakdown: Json | null
          created_at: string
          date: string
          device_breakdown: Json | null
          hour: number | null
          id: string
          link_id: string
          referrer_breakdown: Json | null
          unique_visitors: number
          updated_at: string
        }
        Insert: {
          browser_breakdown?: Json | null
          click_count?: number
          conversion_data?: Json | null
          country_breakdown?: Json | null
          created_at?: string
          date: string
          device_breakdown?: Json | null
          hour?: number | null
          id?: string
          link_id: string
          referrer_breakdown?: Json | null
          unique_visitors?: number
          updated_at?: string
        }
        Update: {
          browser_breakdown?: Json | null
          click_count?: number
          conversion_data?: Json | null
          country_breakdown?: Json | null
          created_at?: string
          date?: string
          device_breakdown?: Json | null
          hour?: number | null
          id?: string
          link_id?: string
          referrer_breakdown?: Json | null
          unique_visitors?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_aggregates_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_analytics_aggregate: {
        Args: {
          p_link_id: string
          p_date: string
          p_hour: number
          p_country: string | null
          p_device_type: string | null
          p_browser: string | null
          p_count?: number
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
