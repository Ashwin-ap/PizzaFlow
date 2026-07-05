"use client";

import { useEffect, useState } from "react";
import { Star, Timer, ChefHat } from "lucide-react";
import { nameSchema, phoneSchema } from "@/lib/validation";
import { CravingsRail, type Craving } from "./CravingsRail";

/** Hero carousel slides — max 5, each a real photo with a marketing tag. */
const SLIDES: { img: string; tag: string; name: string }[] = [
  { img: "/food/margherita.jpg", tag: "Bestseller", name: "Wood-fired Margherita" },
  { img: "/food/pepperoni.jpg", tag: "New", name: "Pepperoni Classic" },
  { img: "/food/veggie.jpg", tag: "Today's Special", name: "Veggie Supreme" },
  { img: "/food/bbq.jpg", tag: "Chef's Special", name: "Smoky BBQ Chicken" },
  { img: "/food/periperi.jpg", tag: "Trending", name: "Peri-Peri Paneer" },
];

/**
 * Step 1 — customer intake (FR-1 name, FR-2 phone). Native controlled inputs
 * validated with the SHARED Zod schemas on submit; invalid → stay on step with
 * inline, screen-reader-announced errors (PRD §10.2 #6, §10.3 aria-live).
 *
 * Wrapped in an appetite-first landing hero (an auto-rotating photo carousel + a
 * clickable cravings rail) so the first screen sells before it asks. Clicking a
 * craving adds that pizza to the cart without leaving the flow.
 */
export function IntakeForm({
  initial,
  cartCount,
  onPickCraving,
  onNext,
}: {
  initial: { name: string; phone: string };
  cartCount: number;
  onPickCraving: (craving: Craving) => void;
  onNext: (customer: { name: string; phone: string }) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nameR = nameSchema.safeParse(name);
    const phoneR = phoneSchema.safeParse(phone);
    const next: { name?: string; phone?: string } = {};
    if (!nameR.success) next.name = nameR.error.issues[0].message;
    if (!phoneR.success) next.phone = phoneR.error.issues[0].message;
    setErrors(next);
    if (nameR.success && phoneR.success) {
      onNext({ name: nameR.data, phone: phoneR.data });
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        {/* Copy + form */}
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 md:order-1">
          <div>
            <p className="eyebrow mb-2">— Step 1 · Your details</p>
            <h2 className="text-3xl font-semibold leading-tight text-ink md:text-4xl">
              Hot, fresh pizza —<br />
              <span className="text-primary">built your way.</span>
            </h2>
            <p className="mt-2 text-sm text-ink-mute">
              Drop your name &amp; number and start building — wood-fired, server-priced,
              on your doorstep in 30 minutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="trust-chip">
              <Star size={14} className="text-star" fill="currentColor" aria-hidden /> 4.8 · 2k+ ratings
            </span>
            <span className="trust-chip">
              <Timer size={14} className="text-ink-secondary" aria-hidden /> Fresh in 30 min
            </span>
            <span className="trust-chip">
              <ChefHat size={14} className="text-primary" aria-hidden /> Wood-fired
            </span>
          </div>

          <label htmlFor="name" className="flex flex-col gap-1">
            <span className="text-sm text-ink-secondary">Name</span>
            <input
              id="name"
              name="name"
              className="input"
              value={name}
              autoComplete="name"
              suppressHydrationWarning
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
            {errors.name && (
              <span id="name-error" role="alert" aria-live="polite" className="field-error">
                {errors.name}
              </span>
            )}
          </label>

          <label htmlFor="phone" className="flex flex-col gap-1">
            <span className="text-sm text-ink-secondary">Phone</span>
            <input
              id="phone"
              name="phone"
              inputMode="numeric"
              className="input tnum"
              value={phone}
              autoComplete="tel"
              suppressHydrationWarning
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
              }}
            />
            {errors.phone && (
              <span id="phone-error" role="alert" aria-live="polite" className="field-error">
                {errors.phone}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <button type="submit" className="btn btn-primary self-start">
              {cartCount > 0 ? `Start my order → (${cartCount} added)` : "Start my order →"}
            </button>
            {cartCount > 0 && (
              <p className="text-xs text-ink-mute" aria-live="polite">
                {`${cartCount} ${cartCount === 1 ? "pizza" : "pizzas"} added — you'll review them next.`}
              </p>
            )}
          </div>
        </form>

        {/* Appetite hero — auto-rotating photo carousel */}
        <div className="md:order-2">
          <HeroCarousel />
        </div>
      </div>

      {/* Cravings rail — clickable; each adds the mapped pizza to your order. */}
      <CravingsRail onPick={onPickCraving} />
    </div>
  );
}

/** Auto-advancing photo carousel (one slide at a time, fade transition, dot nav). */
function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % SLIDES.length), 3000);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className="hero-photo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, idx) => (
        <div key={s.tag} className={`carousel-slide ${idx === i ? "is-active" : ""}`} aria-hidden={idx !== i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.img} alt={idx === i ? `${s.name} — ${s.tag}` : ""} />
          <span className="hero-badge">{s.tag}</span>
          <span className="hero-caption">{s.name}</span>
        </div>
      ))}
      <div className="carousel-dots">
        {SLIDES.map((s, idx) => (
          <button
            key={s.tag}
            type="button"
            className={`carousel-dot ${idx === i ? "is-active" : ""}`}
            onClick={() => setI(idx)}
            aria-label={`Show ${s.tag}`}
          />
        ))}
      </div>
    </div>
  );
}
