"use client";

import type { CSSProperties, ReactNode } from "react";

import { useCompanyBranding } from "@/lib/branding/use-company-branding";

import styles from "./letter.module.css";

function letterPageStyle(backgroundUrl: string | null): CSSProperties | undefined {
  if (!backgroundUrl) return undefined;
  return { backgroundImage: `url(${backgroundUrl})` };
}

/** A4 letter page frame — letterhead background comes from Super Admin branding settings. */
export function LetterPage({ children }: { children: ReactNode }) {
  const { branding } = useCompanyBranding();
  return (
    <div className={styles.printOnly}>
      <div className={styles.letterPage} style={letterPageStyle(branding.backgroundUrl)}>
        <div className={styles.letterContent}>{children}</div>
      </div>
    </div>
  );
}

/** Multi-sheet letter — one page per array item, each on its own printed A4 sheet. */
export function LetterPages({ pages }: { pages: ReactNode[] }) {
  const { branding } = useCompanyBranding();
  const pageStyle = letterPageStyle(branding.backgroundUrl);
  return (
    <div className={styles.printOnly}>
      {pages.map((page, index) => (
        <div key={index} className={styles.letterPage} style={pageStyle}>
          <div className={styles.letterContent}>{page}</div>
        </div>
      ))}
    </div>
  );
}

/** Text-only signature block — company fields from branding settings. */
export function SignatureBlock({
  signOff = "Warm regards,",
  splitTitle = false,
  signLine = false,
  showSignatory = true,
  signSpace = false,
}: {
  signOff?: string | null;
  /** HR title and company on separate lines, matching the stamp block on some letters. */
  splitTitle?: boolean;
  signLine?: boolean;
  showSignatory?: boolean;
  /** Blank space after the closing for a physical signature / stamp. */
  signSpace?: boolean;
}) {
  const { branding } = useCompanyBranding();
  const companyName = branding.companyName || "Company";
  const hrTitle = branding.hrTitle || "HR Manager";
  const signatoryName = branding.signatoryName || "Authorised Signatory";

  return (
    <div className={styles.signatureBlock}>
      {signOff ? <p className={styles.signOff}>{signOff}</p> : null}
      {signSpace ? <div className={styles.signatureSpace} aria-hidden /> : null}
      {showSignatory ? <p className={styles.signatureName}>{signatoryName}</p> : null}
      {splitTitle ? (
        <>
          <p className={styles.signatureTitle}>{hrTitle}</p>
          <p className={styles.signatureTitle}>{companyName}</p>
        </>
      ) : (
        <p className={styles.signatureTitle}>
          {hrTitle}, {companyName}
        </p>
      )}
      {signLine ? <div className={styles.certificateSignLine} /> : null}
    </div>
  );
}
