import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { IncrementLetterData } from "./types";

/** Print-ready A4 increment letter. */
export default function IncrementLetterTemplate({ data }: { data: IncrementLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Increment Letter</h1>

      <div className={styles.recipientHead}>
        <p className={styles.addressBlock}>
          {data.candidateName}
          {data.address ? `\n${data.address}` : ""}
        </p>
        <p className={`${styles.headDate} ${styles.numeric}`}>{data.effectiveDate}</p>
      </div>

      <p className={styles.greeting}>Dear {data.candidateFirstName}</p>

      <p className={styles.paragraph}>
        I hope this letter finds you in good health and high spirits.
      </p>

      <p className={styles.paragraph}>
        At {data.companyName}, we greatly appreciate the dedication and hard work of our employees.
        After a thorough review of your performance, we are pleased to acknowledge your outstanding
        contributions, which have significantly impacted our projects&apos; success and the overall
        growth of the company.
      </p>

      <p className={styles.paragraph}>
        In recognition of your efforts and to align your compensation with your responsibilities and
        market standards, we are delighted to inform you of a salary increment. Effective{" "}
        <strong className={styles.numeric}>{data.effectiveDate}</strong>, your revised salary will
        be <strong>{data.revisedSalary}</strong>, reflecting an increase over your current salary.
        This adjustment is a testament to our appreciation of your commitment to excellence and the
        value you bring to {data.companyName}.
      </p>

      <p className={styles.paragraph}>
        Your monthly salary includes various components, including a{" "}
        <strong>
          <span className={styles.numeric}>{data.loyaltyBonusRate}</span>% loyalty bonus
        </strong>{" "}
        deduction from the gross amount. This loyalty bonus will be returned to you upon contract
        renewal, along with any accumulated total. Additionally, an interest rate of 3%-5% on the
        Recurring Deposit will be credited to the loyalty bonus amount as part of your employee
        benefits.
      </p>

      <p className={styles.paragraph}>
        Additionally, as per your employment contract, your tenure has been renewed for the next
        year. All the rules and regulations will continue to be governed by the HRD Guidelines of{" "}
        {data.companyName}, ensuring compliance with company policies and maintaining a productive
        work environment.
      </p>

      <p className={styles.paragraph}>
        Once again, congratulations on this well-deserved recognition. We look forward to your
        continued contributions and success at {data.companyName}. Thank you for your hard work and
        dedication.
      </p>

      <SignatureBlock signOff="Sincerely," />
    </LetterPage>
  );
}
