import { useEffect, useId, useRef } from 'react';
import type { FieldErrors } from '../lib/types';

/**
 * Lists every error at the top of the form and takes focus when the form is
 * submitted with problems. Each entry links to its field, so keyboard and
 * screen reader users can jump straight to what needs fixing.
 */
export function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const entries = Object.entries(errors);

  useEffect(() => {
    if (Object.keys(errors).length > 0) ref.current?.focus();
  }, [errors]);

  if (entries.length === 0) return null;
  return (
    <div ref={ref} className="error-summary" role="alert" tabIndex={-1} aria-labelledby={titleId}>
      <h3 id={titleId}>There is a problem</h3>
      <ul>
        {entries.map(([id, message]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(id)?.focus();
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
