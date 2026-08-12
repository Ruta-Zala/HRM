import type { ReactNode } from "react";

import { COMPANY } from "./letter-utils";
import styles from "./letter.module.css";

/** A4 letter page frame shared by every letter template — the letterhead (logo, header
 * bars, watermark, footer) is a single full-page background image (see letter.module.css). */
export function LetterPage({ children }: { children: ReactNode }) {
  return (
    <div className={styles.printOnly}>
      <div className={styles.letterPage}>
        <div className={styles.letterContent}>{children}</div>
      </div>
    </div>
  );
}

/** Multi-sheet letter — one page per array item, each on its own printed A4 sheet. */
export function LetterPages({ pages }: { pages: ReactNode[] }) {
  return (
    <div className={styles.printOnly}>
      {pages.map((page, index) => (
        <div key={index} className={styles.letterPage}>
          <div className={styles.letterContent}>{page}</div>
        </div>
      ))}
    </div>
  );
}

/** Text-only signature block — this branch has no signature-image upload flow. */
export function SignatureBlock({ signOff = "Warm regards," }: { signOff?: string }) {
  return (
    <div className={styles.signatureBlock}>
      <p className={styles.signOff}>{signOff}</p>
      <p className={styles.signatureName}>{COMPANY.signatoryName}</p>
      <p className={styles.signatureTitle}>
        {COMPANY.hrTitle}, {COMPANY.name}
      </p>
    </div>
  );
}
