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
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      Game: {
        Row: {
          blackPlayerId: string | null
          blackRemainingMs: number
          createdAt: string
          currentTurn: Database["public"]["Enums"]["Color"]
          drawOfferedBy: Database["public"]["Enums"]["Color"] | null
          endReason: Database["public"]["Enums"]["EndReason"] | null
          finishedAt: string | null
          id: string
          lastMoveAt: string | null
          result: Database["public"]["Enums"]["GameResult"] | null
          status: Database["public"]["Enums"]["GameStatus"]
          timeControlId: string
          timeIncrementMs: number
          timeInitialMs: number
          whitePlayerId: string | null
          whiteRemainingMs: number
        }
        Insert: {
          blackPlayerId?: string | null
          blackRemainingMs: number
          createdAt?: string
          currentTurn?: Database["public"]["Enums"]["Color"]
          drawOfferedBy?: Database["public"]["Enums"]["Color"] | null
          endReason?: Database["public"]["Enums"]["EndReason"] | null
          finishedAt?: string | null
          id: string
          lastMoveAt?: string | null
          result?: Database["public"]["Enums"]["GameResult"] | null
          status?: Database["public"]["Enums"]["GameStatus"]
          timeControlId: string
          timeIncrementMs: number
          timeInitialMs: number
          whitePlayerId?: string | null
          whiteRemainingMs: number
        }
        Update: {
          blackPlayerId?: string | null
          blackRemainingMs?: number
          createdAt?: string
          currentTurn?: Database["public"]["Enums"]["Color"]
          drawOfferedBy?: Database["public"]["Enums"]["Color"] | null
          endReason?: Database["public"]["Enums"]["EndReason"] | null
          finishedAt?: string | null
          id?: string
          lastMoveAt?: string | null
          result?: Database["public"]["Enums"]["GameResult"] | null
          status?: Database["public"]["Enums"]["GameStatus"]
          timeControlId?: string
          timeIncrementMs?: number
          timeInitialMs?: number
          whitePlayerId?: string | null
          whiteRemainingMs?: number
        }
        Relationships: [
          {
            foreignKeyName: "Game_blackPlayerId_fkey"
            columns: ["blackPlayerId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Game_whitePlayerId_fkey"
            columns: ["whitePlayerId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      GameInvite: {
        Row: {
          createdAt: string
          expiresAt: string
          gameId: string | null
          id: string
          pairKey: string | null
          recipientId: string
          respondedAt: string | null
          senderColor: Database["public"]["Enums"]["Color"] | null
          senderId: string
          status: Database["public"]["Enums"]["InviteStatus"]
          timeControlId: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          gameId?: string | null
          id: string
          pairKey?: string | null
          recipientId: string
          respondedAt?: string | null
          senderColor?: Database["public"]["Enums"]["Color"] | null
          senderId: string
          status?: Database["public"]["Enums"]["InviteStatus"]
          timeControlId: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          gameId?: string | null
          id?: string
          pairKey?: string | null
          recipientId?: string
          respondedAt?: string | null
          senderColor?: Database["public"]["Enums"]["Color"] | null
          senderId?: string
          status?: Database["public"]["Enums"]["InviteStatus"]
          timeControlId?: string
        }
        Relationships: [
          {
            foreignKeyName: "GameInvite_gameId_fkey"
            columns: ["gameId"]
            isOneToOne: false
            referencedRelation: "Game"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GameInvite_recipientId_fkey"
            columns: ["recipientId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GameInvite_senderId_fkey"
            columns: ["senderId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      Move: {
        Row: {
          color: Database["public"]["Enums"]["Color"]
          gameId: string
          id: string
          move: Json
          playedAt: string
          ply: number
        }
        Insert: {
          color: Database["public"]["Enums"]["Color"]
          gameId: string
          id: string
          move: Json
          playedAt?: string
          ply: number
        }
        Update: {
          color?: Database["public"]["Enums"]["Color"]
          gameId?: string
          id?: string
          move?: Json
          playedAt?: string
          ply?: number
        }
        Relationships: [
          {
            foreignKeyName: "Move_gameId_fkey"
            columns: ["gameId"]
            isOneToOne: false
            referencedRelation: "Game"
            referencedColumns: ["id"]
          },
        ]
      }
      Profile: {
        Row: {
          createdAt: string
          id: string
          updatedAt: string
          username: string | null
        }
        Insert: {
          createdAt?: string
          id: string
          updatedAt: string
          username?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          updatedAt?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      Color: "white" | "black"
      EndReason:
        | "checkmate"
        | "stalemate"
        | "draw"
        | "timeout"
        | "resignation"
        | "agreement"
      GameResult: "white_wins" | "black_wins" | "draw"
      GameStatus: "active" | "finished"
      InviteStatus:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "expired"
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
    Enums: {
      Color: ["white", "black"],
      EndReason: [
        "checkmate",
        "stalemate",
        "draw",
        "timeout",
        "resignation",
        "agreement",
      ],
      GameResult: ["white_wins", "black_wins", "draw"],
      GameStatus: ["active", "finished"],
      InviteStatus: ["pending", "accepted", "declined", "cancelled", "expired"],
    },
  },
} as const
