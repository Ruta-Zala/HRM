import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { OfferLetterData } from "./types";

/** Print-ready A4 internship offer letter. */
export default function OfferLetterTemplate({ data }: { data: OfferLetterData }) {
  return (
    <LetterPage>
      <h1 className={styles.letterTitle}>Internship Offer Letter</h1>

      <p className={styles.dateRight}>Date: {data?.offerDate}</p>

      <p className={styles.greeting}>Dear {data.candidateName},</p>

      <p className={styles.paragraph}>
        We are pleased to offer you an Internship Opportunity with{" "}
        <strong>ExhiByte Solutions</strong> for the position of <strong>{data.position}</strong>. We
        were impressed with your skills, enthusiasm, and technical potential during the selection
        process and are excited to have you as part of our team.
      </p>

      <div className={styles.details}>
        <p className={styles.detailsTitle}>Below are the details of your internship:</p>
        <p>Position: {data.position} (Intern)</p>
        <p>
          Internship Duration: {data.durationStart} to {data.durationEnd}
        </p>
        <p>Working Days: {data.workingDays}</p>
        <p>Working Hours: {data.workingHours}</p>
      </div>

      <p className={styles.paragraph}>
        During your internship, you will have the opportunity to work on real-time projects,
        collaborate with senior developers, and enhance your technical and professional skills.
      </p>

      <p className={styles.paragraph}>
        Upon successful completion of your internship and satisfactory performance evaluation, you
        may be considered for a full-time employment opportunity with ExhiByte Solutions.
      </p>

      <p className={styles.paragraph}>
        Please confirm your acceptance of this offer by replying to this email or signing and
        returning a copy of this letter by <strong>{data.acceptanceDeadline}</strong>.
      </p>

      <p className={styles.paragraph}>
        We look forward to having you on our team and wish you all the best for your learning
        journey with us.
      </p>

      <SignatureBlock />
    </LetterPage>
  );
}
