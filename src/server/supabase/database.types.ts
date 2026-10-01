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
          match_id: string | null;
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
          match_id?: string | null;
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
          match_id?: string | null;
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
        Relationships: [
          {
            foreignKeyName: "battles_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "online_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_entries: {
        Row: {
          challenge_id: string;
          packed_team: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          challenge_id: string;
          packed_team?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          packed_team?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
      challenges: {
        Row: {
          challenged_id: string;
          challenged_ready: boolean;
          challenger_id: string;
          challenger_ready: boolean;
          create_request_id: string;
          created_at: string;
          expires_at: string;
          format_id: string;
          id: string;
          invite_ttl_minutes: number;
          match_id: string | null;
          ou_team_source: string;
          prepare_expires_at: string | null;
          status: string;
          timer_seconds: number | null;
          updated_at: string;
        };
        Insert: {
          challenged_id: string;
          challenged_ready?: boolean;
          challenger_id: string;
          challenger_ready?: boolean;
          create_request_id: string;
          created_at?: string;
          expires_at: string;
          format_id: string;
          id?: string;
          invite_ttl_minutes: number;
          match_id?: string | null;
          ou_team_source: string;
          prepare_expires_at?: string | null;
          status?: string;
          timer_seconds?: number | null;
          updated_at?: string;
        };
        Update: {
          challenged_id?: string;
          challenged_ready?: boolean;
          challenger_id?: string;
          challenger_ready?: boolean;
          create_request_id?: string;
          created_at?: string;
          expires_at?: string;
          format_id?: string;
          id?: string;
          invite_ttl_minutes?: number;
          match_id?: string | null;
          ou_team_source?: string;
          prepare_expires_at?: string | null;
          status?: string;
          timer_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenges_match_fk";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "online_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      friend_requests: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          responded_at: string | null;
          status: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          responded_at?: string | null;
          status?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          created_at: string;
          user_high: string;
          user_low: string;
        };
        Insert: {
          created_at?: string;
          user_high: string;
          user_low: string;
        };
        Update: {
          created_at?: string;
          user_high?: string;
          user_low?: string;
        };
        Relationships: [];
      };
      online_match_secrets: {
        Row: {
          checkpoint: Json;
          input_log: string[];
          match_id: string;
          p1_team: string;
          p2_team: string;
          seed: string;
        };
        Insert: {
          checkpoint: Json;
          input_log?: string[];
          match_id: string;
          p1_team: string;
          p2_team: string;
          seed: string;
        };
        Update: {
          checkpoint?: Json;
          input_log?: string[];
          match_id?: string;
          p1_team?: string;
          p2_team?: string;
          seed?: string;
        };
        Relationships: [
          {
            foreignKeyName: "online_match_secrets_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "online_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      online_matches: {
        Row: {
          challenge_id: string | null;
          created_at: string;
          end_reason: string | null;
          engine_version: string;
          finished_at: string | null;
          format_id: string;
          id: string;
          p1_battle_id: string;
          p1_deadline: string | null;
          p1_pending: boolean;
          p1_user_id: string | null;
          p2_battle_id: string;
          p2_deadline: string | null;
          p2_pending: boolean;
          p2_user_id: string | null;
          revision: number;
          status: string;
          timer_seconds: number | null;
          turn: number;
          updated_at: string;
          winner: string | null;
        };
        Insert: {
          challenge_id?: string | null;
          created_at?: string;
          end_reason?: string | null;
          engine_version: string;
          finished_at?: string | null;
          format_id: string;
          id: string;
          p1_battle_id: string;
          p1_deadline?: string | null;
          p1_pending?: boolean;
          p1_user_id?: string | null;
          p2_battle_id: string;
          p2_deadline?: string | null;
          p2_pending?: boolean;
          p2_user_id?: string | null;
          revision?: number;
          status?: string;
          timer_seconds?: number | null;
          turn?: number;
          updated_at?: string;
          winner?: string | null;
        };
        Update: {
          challenge_id?: string | null;
          created_at?: string;
          end_reason?: string | null;
          engine_version?: string;
          finished_at?: string | null;
          format_id?: string;
          id?: string;
          p1_battle_id?: string;
          p1_deadline?: string | null;
          p1_pending?: boolean;
          p1_user_id?: string | null;
          p2_battle_id?: string;
          p2_deadline?: string | null;
          p2_pending?: boolean;
          p2_user_id?: string | null;
          revision?: number;
          status?: string;
          timer_seconds?: number | null;
          turn?: number;
          updated_at?: string;
          winner?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "online_matches_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: true;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          friend_code: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          friend_code?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          friend_code?: string;
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
      user_presence: {
        Row: {
          last_seen_at: string;
          user_id: string;
        };
        Insert: {
          last_seen_at?: string;
          user_id: string;
        };
        Update: {
          last_seen_at?: string;
          user_id?: string;
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
      commit_online_step: {
        Args: {
          p_actor_side: string;
          p_advanced: boolean;
          p_checkpoint: Json;
          p_choice: Json;
          p_client_request_id: string;
          p_end_reason: string;
          p_expected_revision: number;
          p_input_log_delta: string[];
          p_kind: string;
          p_match_id: string;
          p_p1_frame: Json;
          p_p1_pending: boolean;
          p_p1_request: Json;
          p_p2_frame: Json;
          p_p2_pending: boolean;
          p_p2_request: Json;
          p_status: string;
          p_timeout_sides: string[];
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
      create_challenge: {
        Args: {
          p_challenged: string;
          p_challenger: string;
          p_format_id: string;
          p_invite_ttl_minutes: number;
          p_ou_team_source: string;
          p_request_id: string;
          p_timer_seconds: number;
        };
        Returns: string;
      };
      create_online_match: {
        Args: {
          p_background: string;
          p_challenge_id: string;
          p_checkpoint: Json;
          p_engine_version: string;
          p_input_log: string[];
          p_match_id: string;
          p_p1_battle_id: string;
          p_p1_frame: Json;
          p_p1_initial: Json;
          p_p1_name: string;
          p_p1_pending: boolean;
          p_p1_request: Json;
          p_p1_team: string;
          p_p2_battle_id: string;
          p_p2_frame: Json;
          p_p2_initial: Json;
          p_p2_name: string;
          p_p2_pending: boolean;
          p_p2_request: Json;
          p_p2_team: string;
          p_seed: string;
          p_turn: number;
        };
        Returns: string;
      };
      expire_stale_challenges: { Args: { p_user: string }; Returns: undefined };
      finish_online_seat: {
        Args: {
          p_battle_id: string;
          p_end_reason: string;
          p_result_winner: string;
          p_turn: number;
        };
        Returns: undefined;
      };
      gen_friend_code: { Args: never; Returns: string };
      remove_friend: {
        Args: { p_friend: string; p_user: string };
        Returns: undefined;
      };
      respond_challenge: {
        Args: { p_action: string; p_challenge_id: string; p_user: string };
        Returns: string;
      };
      respond_friend_request: {
        Args: { p_action: string; p_request_id: string; p_user: string };
        Returns: undefined;
      };
      send_friend_request: {
        Args: { p_code: string; p_user: string };
        Returns: Json;
      };
      set_challenge_ready: {
        Args: {
          p_challenge_id: string;
          p_packed_team: string;
          p_ready: boolean;
          p_user: string;
        };
        Returns: boolean;
      };
      touch_presence: { Args: { p_user: string }; Returns: undefined };
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
