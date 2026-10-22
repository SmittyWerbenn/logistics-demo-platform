import { useEffect } from "react";

const SITE_NAME = "Gmslogistics";

/** Sets the browser tab title for the current page (lightweight, CSR-only SEO aid). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
