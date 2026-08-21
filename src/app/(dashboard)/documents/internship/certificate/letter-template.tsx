import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { CertificateLetterData } from "./types";

/** Print-ready A4 internship completion certificate. */
export default function CertificateTemplate({ data }: { data: CertificateLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Internship Certificate</h1>

      <p className={styles.dateRight}>
        <span className={styles.numeric}>{data.issueDate}</span>
      </p>

      <p className={styles.paragraph}>
        This is to certify that {data.honorific} <strong>{data.candidateName}</strong> has
        successfully completed an internship with <strong>{data.companyName}</strong> as a{" "}
        <strong>{data.position}</strong> from{" "}
        <strong>
          <span className={styles.numeric}>{data.startDate}</span>
        </strong>{" "}
        to{" "}
        <strong>
          <span className={styles.numeric}>{data.endDate}</span>
        </strong>
        .
      </p>

      <p className={styles.paragraph}>
        During the internship period, {data.subjectLower} demonstrated dedication, enthusiasm,
        willingness to learn, and a professional attitude towards the assigned responsibilities.{" "}
        {data.subject} actively participated in the assigned tasks and gained valuable practical
        knowledge and experience.
      </p>

      <p className={styles.paragraph}>
        We appreciate <strong>{data.candidateName}</strong> contribution during the internship and
        wish {data.object} all the best for future endeavors.
      </p>

      <SignatureBlock signOff={null} splitTitle signLine />
    </LetterPage>
  );
}
