"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const inputClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClass =
  "rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

function traducirError(error: AuthError | { message: string; code?: string }): string {
  const code = "code" in error ? error.code : undefined;
  const msg = error.message ?? "";
  if (code === "user_already_exists" || /already registered/i.test(msg))
    return "Ese correo ya está registrado. Inicia sesión.";
  if (code === "weak_password" || /at least 6 characters/i.test(msg))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "Correo o contraseña incorrectos.";
  if (code === "email_address_invalid" || /invalid format|is invalid/i.test(msg))
    return "El correo no es válido.";
  return msg || "Ocurrió un error. Intenta de nuevo.";
}

async function leerNombre(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", userId)
    .maybeSingle();
  return data?.nombre ?? null;
}

export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const [regNombre, setRegNombre] = useState("");
  const [regCorreo, setRegCorreo] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [logCorreo, setLogCorreo] = useState("");
  const [logPassword, setLogPassword] = useState("");

  // Recupera la sesión guardada al cargar y escucha cambios (login / logout).
  useEffect(() => {
    // Sin configuración no se muestra el panel (ver el return de abajo).
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) setNombre(await leerNombre(u.id));
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setNombre(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleRegistro(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    if (!regNombre.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setOcupado(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: regCorreo.trim(),
        password: regPassword,
      });
      if (err) {
        setError(traducirError(err));
        return;
      }
      const nuevo = data.user;
      if (!nuevo || !data.session) {
        setError("No se pudo iniciar la sesión tras el registro. Revisa que \"Confirm email\" esté desactivado en Supabase.");
        return;
      }
      const { error: insErr } = await supabase
        .from("perfiles")
        .insert({ id: nuevo.id, nombre: regNombre.trim() });
      if (insErr) {
        setError(`Cuenta creada, pero no se pudo guardar tu nombre: ${insErr.message}`);
        return;
      }
      setUser(nuevo);
      setNombre(regNombre.trim());
      setRegNombre("");
      setRegCorreo("");
      setRegPassword("");
    } finally {
      setOcupado(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setOcupado(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: logCorreo.trim(),
        password: logPassword,
      });
      if (err) {
        setError(traducirError(err));
        return;
      }
      setUser(data.user);
      setNombre(await leerNombre(data.user.id));
      setLogCorreo("");
      setLogPassword("");
    } finally {
      setOcupado(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    setError("");
    await supabase.auth.signOut();
    setUser(null);
    setNombre(null);
  }

  if (!supabaseConfigured || cargando) return null;

  return (
    <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="mx-auto w-full max-w-2xl">
        {user ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Hola, {nombre ?? user.email}</span>
            <button type="button" onClick={handleLogout} className={buttonClass}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={handleRegistro} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Crear cuenta</h2>
              <input
                type="text"
                placeholder="Nombre"
                aria-label="Nombre"
                value={regNombre}
                onChange={(e) => setRegNombre(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Correo"
                aria-label="Correo para registro"
                value={regCorreo}
                onChange={(e) => setRegCorreo(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Contraseña"
                aria-label="Contraseña para registro"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClass}
              />
              <button type="submit" disabled={ocupado} className={buttonClass}>
                Registrarme
              </button>
            </form>
            <form onSubmit={handleLogin} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Iniciar sesión</h2>
              <input
                type="email"
                placeholder="Correo"
                aria-label="Correo para iniciar sesión"
                value={logCorreo}
                onChange={(e) => setLogCorreo(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Contraseña"
                aria-label="Contraseña para iniciar sesión"
                value={logPassword}
                onChange={(e) => setLogPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass}
              />
              <button type="submit" disabled={ocupado} className={buttonClass}>
                Entrar
              </button>
            </form>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
