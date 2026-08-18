import { LetterPage } from "../../_shared/LetterPage";
import { COMPANY } from "../../_shared/letter-utils";
import styles from "../../_shared/letter.module.css";
import type { CertificateLetterData } from "./types";

/** Print-ready A4 internship completion certificate. */
export default function CertificateTemplate({ data }: { data: CertificateLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Internship Certificate</h1>

      <p className={styles.dateRight}>
        Date:- <span className={styles.numeric}>{data.issueDate}</span>
      </p>

      <div className={styles.metaBlock}>
        <p>Name: {data.candidateName}</p>
        <p>Subject: Internship Certificate</p>
      </div>

      <p className={styles.greeting}>
        {data.honorific} {data.candidateName},
      </p>

      <p className={styles.paragraph}>
        This is to certify that <strong>{data.candidateName}</strong> has been actively engaged in a{" "}
        <span className={styles.numeric}>{data.durationMonths}</span> {data.durationMonths > 1 ? "months" : "month"} internship with{" "}
        {COMPANY.name}, commencing from <span className={styles.numeric}>{data.startDate}</span> to{" "}
        <span className={styles.numeric}>{data.endDate}</span>. Throughout this period,{" "}
        {data.candidateFirstName} has been dedicatedly involved in a {data.project} project.
      </p>

      <p className={styles.paragraph}>
        {data.candidateFirstName} has showcased commendable commitment, enthusiasm, and adaptability
        during {data.possessive} internship. {data.subject} has demonstrated strong proficiency in{" "}
        {data.project} and has contributed significantly to the project&apos;s development and
        success.
      </p>

      <div className={styles.signRows}>
        <p>
          <span className={styles.signLabel}>Date</span>:{" "}
          <span className={styles.numeric}>{data.issueDate}</span>
        </p>
        <p>
          <span className={styles.signLabel}>Name</span>: {COMPANY.signatoryName}, {COMPANY.hrTitle}
          , {COMPANY.name}
        </p>
        <p>
          <span className={styles.signLabel}>Sign</span>:
        </p>
      </div>
    </LetterPage>
  );
}
