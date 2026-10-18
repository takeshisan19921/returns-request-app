import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: string;
  error?: string;
}

/** Wires the hint and error to the control through aria-describedby, in reading order. */
function describe(id: string, hint?: string, error?: string) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return {
    hintId,
    errorId,
    aria: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    },
  };
}

function Shell({ id, label, hint, error, children }: FieldProps & { children: ReactNode }) {
  const { hintId, errorId } = describe(id, hint, error);
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}

export function TextField({ id, label, hint, error, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input id={id} {...describe(id, hint, error).aria} {...input} />
    </Shell>
  );
}

export function SelectField({ id, label, hint, error, ...select }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select id={id} {...describe(id, hint, error).aria} {...select} />
    </Shell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea id={id} rows={3} {...describe(id, hint, error).aria} {...textarea} />
    </Shell>
  );
}
