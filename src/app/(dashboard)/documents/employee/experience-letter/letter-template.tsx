import { LetterPage, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { ExperienceLetterData } from "./types";

function additionalRemarkParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Print-ready A4 experience letter. */
export default function ExperienceLetterTemplate({ data }: { data: ExperienceLetterData }) {
  const remarkParagraphs = additionalRemarkParagraphs(data.additionalRemarks);

  return (
    <LetterPage>
      <div className={styles.offerContent} style={{ fontSize: "10pt", lineHeight: 1.5 }}>
        <h1 className={styles.letterTitle}>Experience Letter</h1>

        <p className={styles.dateRight}>
          <span className={styles.numeric}>{data.issueDate}</span>
        </p>

        <p className={styles.paragraph}>
          This is to certify that {data.honorific}
          <strong> {data.candidateName}</strong> was employed at {data.companyName} from{" "}
          <strong>
            <span className={styles.numeric}>{data.startDate}</span>, to{" "}
            <span className={styles.numeric}>{data.endDate}</span>,
          </strong>{" "}
          as a <strong>{data.position}</strong>.
        </p>

        {remarkParagraphs.length > 0 ? (
          <div className={styles.remarksBlock}>
            {remarkParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        <p className={styles.paragraph}>
          We appreciate {data.object} valuable contribution to the organization and wish{" "}
          {data.possessive} success in {data.object} future career.
        </p>

        <SignatureBlock signOff="Sincerely," />
      </div>
    </LetterPage>
  );
}
