"use client";

import { useState } from "react";
import { nameSchema, phoneSchema } from "@/lib/validation";

/**
 * Step 1 — customer intake (FR-1 name, FR-2 phone). Native controlled inputs
 * validated with the SHARED Zod schemas on submit; invalid → stay on step with
 * inline, screen-reader-announced errors (PRD §10.2 #6, §10.3 aria-live).
 */
export function IntakeForm({
  initial,
  onNext,
}: {
  initial: { name: string; phone: string };
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
      // nameSchema trims — persist the normalized value.
      onNext({ name: nameR.data, phone: phoneR.data });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">— Step 1 · Your details</p>
        <h2 className="text-2xl font-semibold text-ink">Who&apos;s ordering?</h2>
      </div>

      <label htmlFor="name" className="flex flex-col gap-1">
        <span className="text-sm text-ink-secondary">Name</span>
        <input
          id="name"
          name="name"
          className="input"
          value={name}
          autoComplete="name"
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

      <div>
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </div>
    </form>
  );
}
