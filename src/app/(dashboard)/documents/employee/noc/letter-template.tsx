import { LetterPage } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { NocLetterData } from "./types";

export default function NocTemplate({ data }: { data: NocLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Non-Objection Certificate</h1>

      <p className={styles.dateRight}>
        <span className={styles.numeric}>{data.date}</span>
      </p>

      <p className={styles.greeting}>
        Dear <strong>{data.candidateName}</strong>,
      </p>

      <p className={styles.paragraph}>
        This is to certify that {data.honorific} <strong>{data.candidateName}</strong> has no
        objection from <strong>{data.companyName}</strong> regarding {data.possessive} separation
        from the company. {data.subject} was employed with the company and provided{" "}
        {data.possessive} services/Documents/Deposit during {data.possessive} tenure. We hereby
        confirm that {data.subjectLower} has cleared all outstanding dues and received all{" "}
        {data.possessive} security documents from <strong>{data.companyName}</strong>.
      </p>

      <p className={styles.paragraph}>
        You acknowledge that you have received all the documents submitted at the time of joining
        the company and have verified that all the documents are correct. You agree that the company
        has returned all your documents to you and, therefore, has no further responsibility or
        liability for those documents.
      </p>

      <p className={styles.paragraph}>
        By signing below, you acknowledge that you have read and understood the foregoing agreement
        and agree to comply with all its terms.
      </p>

      <p className={styles.paragraph}>
        We wish {data.object} success in {data.possessive} future career.
      </p>

      <p className={styles.nocSignHead}>For {data.companyName}</p>
      <div className={styles.nocSignRow}>
        <div className={styles.nocSignCol}>
          <p className={styles.nocSignLine}>
            HR Manager: <span className={styles.nocSignRule} />
          </p>
          <p className={styles.nocSignDate}>Date:</p>
        </div>
        <div className={styles.nocSignCol}>
          <p className={styles.nocSignLine}>
            Employee Signature: <span className={styles.nocSignRule} />
          </p>
          <p className={styles.nocSignDate}>Date:</p>
        </div>
      </div>
    </LetterPage>
  );
}
