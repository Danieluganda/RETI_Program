"use client";

export function ClosePageButton() {
  return (
    <button className="secondary" type="button" onClick={() => window.close()}>
      Exit
    </button>
  );
}
