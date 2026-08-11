import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { ExperienceLetterData } from "./types";

/** Print-ready A4 experience letter. */
export default function ExperienceLetterTemplate({ data }: { data: ExperienceLetterData }) {
  return (
    <LetterPage>
      <div className={styles.offerContent} style={{ fontSize: "10pt", lineHeight: 1.5 }}>
        <h1 className={styles.letterTitle}>Experience Letter</h1>

        <p className={styles.dateRight}>
          DATE: <span className={styles.numeric}>{data.issueDate}</span>
        </p>

        <div className={styles.metaBlock}>
          <p>Name: {data.candidateName}</p>
          <p>Subject: Experience Letter</p>
        </div>

        <p className={styles.greeting}>
          Dear {data.honorific}
          <strong>{data.candidateName}</strong>,
        </p>

        <p className={styles.paragraph}>
          This is to certify that {data.honorific}
          <strong>{data.candidateName}</strong> was employed at {data.companyName} from{" "}
          <strong>
            <span className={styles.numeric}>{data.startDate}</span>, to{" "}
            <span className={styles.numeric}>{data.endDate}</span>,
          </strong>{" "}
          as a <strong>{data.position}</strong>.
        </p>

        <p className={styles.paragraph}>
          During {data.possessive} tenure with us, {data.subjectLower} demonstrated regularity,
          honesty, and diligence in fulfilling {data.possessive} duties and responsibilities.{" "}
          {data.possessiveCap} professionalism and organizational skills were evident in all{" "}
          {data.possessive} tasks.
        </p>

        <p className={styles.paragraph}>
          We wish {data.object} all the best in {data.possessive} future endeavors.
        </p>

        <SignatureBlock signOff="Sincerely," />
      </div>
    </LetterPage>
  );
}
