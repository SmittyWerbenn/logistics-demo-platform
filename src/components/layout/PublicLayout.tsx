import type { ReactNode } from "react";
import { Footer } from "../compro/Footer";
import { Navbar } from "../compro/Navbar";

/** Shell for the public inner pages (tracking result, contact, about): the same
 * GMS navbar/footer as the company-profile site, on a light page background so
 * cards and status colours stay readable. */
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-gms-mist">
      <Navbar overlay={false} />
      <main className={`mx-auto w-full flex-1 px-4 pb-12 pt-24 sm:pt-28 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
