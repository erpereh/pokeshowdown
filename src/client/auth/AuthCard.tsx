"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser.ts";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { GlassPanel } from "@/client/ui/GlassPanel.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { Icon } from "@/client/ui/Icon.tsx";

type Mode = "login" | "signup" | "recovery" | "password";

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
  const [confirmation, setConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(confirmError ? "El enlace de confirmación no es válido o ha caducado." : null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    if (mode !== "password" && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("El correo no es válido.");
      return;
    }
    if (mode !== "recovery" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    const name = displayName.trim();
    if (mode === "password" && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (mode === "signup" && (name.length < 2 || name.length > 20)) {
      setError("Elige un nombre de entrenador (2–20 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      if (mode === "recovery") {
        const callback = new URL("/auth/confirm", window.location.origin);
        callback.searchParams.set("next", "/auth/update-password");
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo: callback.toString() });
        if (recoveryError) setError(messageFor(recoveryError));
        else setInfo("Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también el correo no deseado.");
        return;
      }
      if (mode === "password") {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) {
          setError(messageFor(passwordError));
          return;
        }
        router.replace(nextPath || "/");
        router.refresh();
        return;
      }
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
          emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
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
    <section className="relative min-h-dvh bg-[radial-gradient(ellipse_at_50%_15%,#233c4c,transparent_65%)]">
      <div className="app-content relative mx-auto flex min-h-dvh max-w-5xl items-center justify-center gap-20 px-4 pt-24 lg:px-8">
        <div className="hidden max-w-sm lg:block">
          <div className="glass-light mb-8 flex size-20 items-center justify-center rounded-3xl text-accent-2"><Icon name="spark" className="size-10" /></div>
          <p className="section-kicker mb-4">Tu estadio te espera</p>
          <p className="font-display text-5xl font-semibold leading-tight">Prepara tu próxima victoria.</p>
          <p className="mt-5 leading-relaxed text-text-dim">Tus equipos, tus partidas y tu estrategia. Todo a tu ritmo.</p>
        </div>
        <GlassPanel className="my-6 w-full max-w-md p-6 sm:p-8">
          <p className="section-kicker">PokeShowdown</p>
          <h1 className="font-display mt-1 text-3xl font-bold">{mode === "password" ? "Nueva contraseña" : mode === "recovery" ? "Recupera tu cuenta" : "Tu entrenador"}</h1>
          {mode === "login" || mode === "signup" ? <p className="mt-2 text-sm text-text-dim">Entra y guarda tu progreso.</p> : null}
          {mode === "login" || mode === "signup" ? <div className="mt-4">
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
          </div> : <p className="mt-3 text-sm text-text-dim">{mode === "password" ? "Elige una contraseña nueva para tu cuenta." : "Te enviaremos un enlace para cambiar la contraseña."}</p>}
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
            {mode !== "password" ? <label className="block text-sm">
              <span className="mb-1 block text-text-dim">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3"
              />
            </label> : null}
            {mode !== "recovery" ? <label className="block text-sm">
              <span className="mb-1 block text-text-dim">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3"
              />
            </label> : null}
            {mode === "password" ? <label className="block text-sm">
              <span className="mb-1 block text-text-dim">Confirmar contraseña</span>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="min-h-11 w-full rounded-[var(--radius-card)] border border-line-strong bg-bg-0/70 px-3" />
            </label> : null}
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
              {mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : mode === "recovery" ? "Enviar enlace" : "Guardar contraseña"}
            </GameButton>
            {mode === "login" || mode === "recovery" ? <GameButton type="button" variant="ghost" disabled={loading} onClick={() => { setMode(mode === "recovery" ? "login" : "recovery"); setError(null); setInfo(null); }}>
              {mode === "recovery" ? "Volver al acceso" : "He olvidado mi contraseña"}
            </GameButton> : null}
          </form>
        </GlassPanel>
      </div>
    </section>
  );
}
