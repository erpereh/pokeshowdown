export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      battle_actions: {
        Row: {
          battle_id: string;
          client_request_id: string;
          created_at: string;
          id: number;
          kind: string;
          p1_choice: Json | null;
          revision_before: number;
        };
        Insert: {
          battle_id: string;
          client_request_id: string;
          created_at?: string;
          id?: never;
          kind: string;
          p1_choice?: Json | null;
          revision_before: number;
        };
        Update: {
          battle_id?: string;
          client_request_id?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          p1_choice?: Json | null;
          revision_before?: number;
        };
        Relationships: [
          {
            foreignKeyName: "battle_actions_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: false;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_replays: {
        Row: {
          battle_id: string;
          created_at: string;
          engine_version: string;
          format_id: string;
          owner_id: string;
          replay: Json;
          result: string;
          turns: number;
        };
        Insert: {
          battle_id: string;
          created_at?: string;
          engine_version: string;
          format_id: string;
          owner_id: string;
          replay: Json;
          result: string;
          turns: number;
        };
        Update: {
          battle_id?: string;
          created_at?: string;
          engine_version?: string;
          format_id?: string;
          owner_id?: string;
          replay?: Json;
          result?: string;
          turns?: number;
        };
        Relationships: [
          {
            foreignKeyName: "battle_replays_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: true;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_secrets: {
        Row: {
          battle_id: string;
          checkpoint: Json;
          input_log: string[];
          p1_team: string;
          p2_team: string;
          seed: string;
        };
        Insert: {
          battle_id: string;
          checkpoint: Json;
          input_log?: string[];
          p1_team: string;
          p2_team: string;
          seed: string;
        };
        Update: {
          battle_id?: string;
          checkpoint?: Json;
          input_log?: string[];
          p1_team?: string;
          p2_team?: string;
          seed?: string;
        };
        Relationships: [
          {
            foreignKeyName: "battle_secrets_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: true;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battles: {
        Row: {
          background: string;
          cpu_name: string;
          create_request_id: string;
          created_at: string;
          end_reason: string | null;
          engine_version: string;
          finished_at: string | null;
          format_id: string;
          frames: Json;
          id: string;
          initial_state: Json;
          mode: string;
          owner_id: string;
          p1_request: Json | null;
          player_name: string;
          revision: number;
          status: string;
          turn: number;
          updated_at: string;
          winner: string | null;
        };
        Insert: {
          background: string;
          cpu_name: string;
          create_request_id: string;
          created_at?: string;
          end_reason?: string | null;
          engine_version: string;
          finished_at?: string | null;
          format_id: string;
          frames?: Json;
          id?: string;
          initial_state: Json;
          mode?: string;
          owner_id: string;
          p1_request?: Json | null;
          player_name: string;
          revision: number;
          status: string;
          turn: number;
          updated_at?: string;
          winner?: string | null;
        };
        Update: {
          background?: string;
          cpu_name?: string;
          create_request_id?: string;
          created_at?: string;
          end_reason?: string | null;
          engine_version?: string;
          finished_at?: string | null;
          format_id?: string;
          frames?: Json;
          id?: string;
          initial_state?: Json;
          mode?: string;
          owner_id?: string;
          p1_request?: Json | null;
          player_name?: string;
          revision?: number;
          status?: string;
          turn?: number;
          updated_at?: string;
          winner?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          created_at: string;
          engine_version: string;
          format_id: string;
          id: string;
          name: string;
          owner_id: string;
          packed_team: string;
          updated_at: string;
          valid: boolean;
        };
        Insert: {
          created_at?: string;
          engine_version: string;
          format_id: string;
          id?: string;
          name: string;
          owner_id: string;
          packed_team: string;
          updated_at?: string;
          valid: boolean;
        };
        Update: {
          created_at?: string;
          engine_version?: string;
          format_id?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          packed_team?: string;
          updated_at?: string;
          valid?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      commit_battle_turn: {
        Args: {
          p_battle_id: string;
          p_checkpoint: Json;
          p_client_request_id: string;
          p_end_reason: string;
          p_expected_revision: number;
          p_frame: Json;
          p_input_log_delta: string[];
          p_kind: string;
          p_owner_id: string;
          p_p1_choice: Json;
          p_p1_request: Json;
          p_status: string;
          p_turn: number;
          p_winner: string;
        };
        Returns: undefined;
      };
      create_battle: {
        Args: {
          p_background: string;
          p_checkpoint: Json;
          p_cpu_name: string;
          p_create_request_id: string;
          p_end_reason?: string;
          p_engine_version: string;
          p_format_id: string;
          p_frame: Json;
          p_id: string;
          p_initial_state: Json;
          p_input_log: string[];
          p_owner_id: string;
          p_p1_request: Json;
          p_p1_team: string;
          p_p2_team: string;
          p_player_name: string;
          p_seed: string;
          p_status?: string;
          p_turn: number;
          p_winner?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
