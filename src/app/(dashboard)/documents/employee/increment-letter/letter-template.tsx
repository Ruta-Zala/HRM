import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { IncrementLetterData } from "./types";

/** Print-ready A4 increment letter. */
export default function IncrementLetterTemplate({ data }: { data: IncrementLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Increment Letter</h1>

      <div className={styles.recipientHead}>
        <div className={styles.recipientMeta}>
          <p className={styles.recipientName}>{data.candidateName}</p>
          {data.address ? <p className={styles.addressBlock}>{data.address}</p> : null}
        </div>
        <p className={`${styles.headDate} ${styles.numeric}`}>{data.letterDate}</p>
      </div>

      <p className={styles.greeting}>Dear {data.candidateFirstName}</p>

      <p className={styles.paragraph}>
        I hope this letter finds you in good health and high spirits.
      </p>

      <p className={styles.paragraph}>
        At <strong>{data.companyName}</strong>, we greatly appreciate the dedication and hard work
        of our employees. After a thorough review of your performance, we are pleased to acknowledge
        your outstanding contributions, which have significantly contributed to the success of our
        projects and the overall growth of the company.
      </p>

      <p className={styles.paragraph}>
        In recognition of your efforts and to align your compensation with your responsibilities and
        market standards, we are delighted to inform you of a salary increment. Effective{" "}
        <strong className={styles.numeric}>{data.effectiveDate}</strong>, your revised monthly
        salary will be <strong>{data.revisedSalary}</strong>, representing an increase from your
        current salary. This adjustment is a testament to our appreciation of your commitment to
        excellence and the value you bring to <strong>{data.companyName}</strong>.
      </p>

      <p className={styles.paragraph}>
        Your monthly salary includes various components, including a{" "}
        <strong>
          <span className={styles.numeric}>{data.loyaltyBonusRate}</span>% loyalty bonus
        </strong>{" "}
        deduction from your gross salary. The accumulated loyalty bonus will be returned to you upon
        contract renewal, along with the applicable accumulated amount. Additionally, an interest
        rate of{" "}
        <strong>
          <span className={styles.numeric}>{data.interestRate}</span>%
        </strong>{" "}
        on the Recurring Deposit (RD) will be credited to the loyalty bonus amount as part of your
        applicable employee benefits.
      </p>

      <p className={styles.paragraph}>
        Furthermore, as per your employment contract, your employment tenure has been renewed for
        another year. All applicable rules, regulations, and terms of employment will continue to be
        governed by the HRD Guidelines and policies of <strong>{data.companyName}</strong>, ensuring
        compliance with company policies and maintaining a productive work environment.
      </p>

      <p className={`${styles.paragraph} ${styles.incrementLastParagraph}`}>
        Once again, congratulations on this well-deserved recognition. We look forward to your
        continued contributions and success at <strong>{data.companyName}</strong>. Thank you for
        your hard work and dedication.
      </p>

      <SignatureBlock signOff="Sincerely," splitTitle showSignatory={false} />
    </LetterPage>
  );
}
