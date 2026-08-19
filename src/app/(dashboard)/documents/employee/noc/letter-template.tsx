import { LetterPage } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { NocLetterData } from "./types";

/** Print-ready A4 No Objection Certificate. */
export default function NocTemplate({ data }: { data: NocLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>No-Objection Certificate</h1>

      <p className={styles.dateRight}>
        Date:- <span className={styles.numeric}>{data.date}</span>
      </p>

      <p className={styles.greeting}>
        Dear{" "}
        <strong>
          {data.honorific}
          {data.candidateName}
        </strong>
        ,
      </p>

      <p className={styles.paragraph}>
        This certificate is to claim no objection to{" "}
        <strong>
          {data.honorific} {data.candidateName}
        </strong>{" "}
        on the {data.companyName}. {data.subject} joined the company and provided {data.possessive}{" "}
        services/Documents/Deposit in the company. We hereby inform that {data.subjectLower} has
        cleared all {data.possessive} balances and received {data.possessive} security docs from{" "}
        <strong>{data.companyName}.</strong>
      </p>

      <p className={styles.paragraph}>
        You acknowledge that you&apos;ve received all the documents which are submitted while
        joining the company and you&apos;ve verified that all the documents are correct. You are
        agreeing that the company has given your document back to you. And now the company has no
        responsibilities for your document.
      </p>

      <p className={styles.paragraph}>
        By your signature below you acknowledge that you have read and understood the foregoing
        Agreement, that you agree to comply with all of the terms of the Agreement.
      </p>

      <div className={styles.blankSignRow}>
        <div>Date</div>
        <div>Employee Signature</div>
      </div>
    </LetterPage>
  );
}
