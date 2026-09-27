"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser.ts";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { GlassPanel } from "@/client/ui/GlassPanel.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";

type Mode = "login" | "signup";

const ARENA = "/assets/generated/sprites/gen6bgs/bg-skypillar.jpg";

function messageFor(error: { message: string; code?: string }): string {
  const code = error.code ?? "";
  const text = error.message.toLowerCase();
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return "Confirma tu correo antes de entrar. Revisa la bandeja de entrada y el correo no deseado.";
  }
  if (code === "invalid_credentials" || text.includes("invalid login")) {
    return "Correo o contraseña incorrectos.";
  }
  if (code === "user_already_exists" || text.includes("already registered") || text.includes("already been registered")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión.";
  }
  if (text.includes("password")) return "La contraseña no cumple los requisitos (mínimo 6 caracteres).";
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

export function AuthCard({ initialMode, nextPath, confirmError }: { initialMode: Mode; nextPath: string; confirmError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(confirmError ? "El enlace de confirmación no es válido o ha caducado." : null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bgOk, setBgOk] = useState(true);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("El correo no es válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    const name = displayName.trim();
    if (mode === "signup" && (name.length < 2 || name.length > 20)) {
      setError("Elige un nombre de entrenador (2–20 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      if (mode === "login") {
        const { error: signError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (signError) {
          setError(messageFor(signError));
          return;
        }
        router.replace(nextPath || "/");
        router.refresh();
        return;
      }

      const origin = window.location.origin;
      const { data, error: signError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/confirm?next=/`,
          data: { display_name: name },
        },
      });
      if (signError) {
        setError(messageFor(signError));
        return;
      }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("Ya existe una cuenta con ese correo. Inicia sesión o confirma el correo si aún no lo has hecho.");
        return;
      }
      if (!data.session) {
        setInfo("Te hemos enviado un correo para confirmar la cuenta. Ábrelo y vuelve a entrar.");
        return;
      }
      router.replace(nextPath || "/");
      router.refresh();
    } catch {
      setError("La autenticación no está disponible en este momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative min-h-dvh overflow-hidden">
      {bgOk ? <img src={ARENA} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setBgOk(false)} /> : null}
      <div className="absolute inset-0 bg-bg-0/70" />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-24">
        <GlassPanel className="w-full max-w-md p-5 sm:p-6">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-accent">PokeShowdown</p>
          <h1 className="font-display mt-1 text-3xl font-bold">Tu entrenador</h1>
          <div className="mt-4">
            <SegmentedControl
              label="Modo de acceso"
              value={mode}
              onChange={(value) => {
                setMode(value);
                setError(null);
                setInfo(null);
              }}
              options={[
                { value: "login", label: "Iniciar sesión" },
                { value: "signup", label: "Crear cuenta" },
              ]}
            />
          </div>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3" noValidate>
            {mode === "signup" ? (
              <label className="block text-sm">
                <span className="mb-1 block text-text-dim">Nombre de entrenador</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                  maxLength={20}
                  className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block text-text-dim">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-text-dim">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {info ? (
              <p role="status" className="text-sm text-accent-2">
                {info}
              </p>
            ) : null}
            <GameButton type="submit" size="lg" loading={loading} className="mt-1 w-full">
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </GameButton>
          </form>
        </GlassPanel>
      </div>
    </section>
  );
}
