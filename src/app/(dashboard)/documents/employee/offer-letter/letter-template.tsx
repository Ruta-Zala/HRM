import { LetterPages, SignatureBlock } from "../../_shared/LetterPage";
import styles from "../../_shared/letter.module.css";
import type { OfferLetterData } from "./types";

/** Print-ready 2-page employment offer letter. */
export default function OfferLetterTemplate({ data }: { data: OfferLetterData }) {
  const page1 = (
    <div className={styles.offerContent}>
      <h1 className={styles.letterTitle}>Offer Letter</h1>

      <p className={styles.nameLine}>{data.candidateName}</p>
      <p className={styles.tightParagraph}>Dear {data.candidateFirstName},</p>
      <p className={styles.tightParagraph}>
        Congratulations! We are pleased to confirm that you have been selected to work at{" "}
        <strong>{data.companyName}.</strong> We are delighted to offer you employment on a full time
        basis in the position of <strong>{data.position}</strong>. It is intended for you to
        commence your employment on{" "}
        <strong className={styles.numeric}>{data.commencementDate}.</strong>
      </p>
      <p className={styles.tightParagraph}>
        Please read this letter carefully and indicate your acceptance of the offer letter by
        signing and returning a copy of this letter.
      </p>

      <p className={styles.sectionHeading}>1. Position:</p>
      <p className={styles.tightParagraph}>
        You will be employed on the terms and conditions in this agreement, the role of{" "}
        <strong>{data.position}.</strong>
      </p>

      <p className={styles.sectionHeading}>2. Location:</p>
      <p className={styles.tightParagraph}>
        Your services are liable to work at the company location{" "}
        <strong>{data.companyAddress}</strong> .
      </p>

      <p className={styles.sectionHeading}>3. Hours of Work:</p>
      <ul className={styles.bulletList}>
        <li>
          As a full-time employee, you will be required to devote substantially the whole of your
          time and attention during the Employer&apos;s ordinary business hours to the performance
          of your duties under this agreement.
        </li>
        <li>
          You will not be entitled to receive any remuneration for work performed outside the hours
          referred to in sub-clause.
        </li>
      </ul>

      <p className={styles.sectionHeading}>4. Salary and Benefits:</p>
      <ul className={styles.bulletList}>
        <li>
          Joining as full-time employment your monthly salary will be{" "}
          <strong>{data.monthlySalary}</strong>.
        </li>
        <li>
          This salary will be paid by Monthly. Salary will be deposited in your specified account.
        </li>
        <li>
          The aforementioned salary constitutes the total compensation package provided by the
          company, encompassing all direct and indirect payments, as well as benefits extended to
          you by the employer.
        </li>
        <li>
          Your monthly salary includes various components, including a{" "}
          <strong>
            <span className={styles.numeric}>{data.loyaltyBonusRate}</span>% loyalty bonus
          </strong>{" "}
          deduction from your gross salary. The accumulated loyalty bonus will be returned to you
          upon contract renewal, along with the applicable accumulated amount. Additionally, an
          interest rate of <strong className={styles.numeric}>{data.interestRate}</strong> on the
          Recurring Deposit (RD) will be credited to the loyalty bonus amount as part of your
          applicable employee benefits.
        </li>
      </ul>

      <p className={styles.sectionHeading}>5. Leave:</p>
      <ul className={styles.bulletList}>
        <li>
          You will be entitled to annual and long service leave in accordance with the applicable
          laws and the leave policy of the company.
        </li>
      </ul>

      <p className={styles.sectionHeading}>6. Responsibilities and Duties:</p>
      <p className={styles.tightParagraph}>
        Your work in the organization will be subject to the rules and regulations of the
        organization as laid down in relation to conduct, discipline and other matters. You will
        always be alive to responsibilities and duties attached to your office and conduct yourself
        accordingly. You must effectively perform to ensure results.
      </p>

      <p className={styles.sectionHeading}>7. Past Records:</p>
      <p className={styles.tightParagraph}>
        This employment offer letter is based on the information furnished in your application for
        employment and during the interviews you had with us. If any declaration given, or
        information furnished by you, to the company proves to be false, or if you are found to have
        willfully suppressed any material information, in such cases, you will be liable to removal
        from services without any notice.
      </p>
    </div>
  );

  const page2 = (
    <div className={styles.offerContent}>
      <p className={styles.sectionHeading}>8. Confidentiality:</p>
      <p className={styles.tightParagraph}>
        You will not, at any time, during the employment or after, without the consent of the
        Management disclose or divulge or make public, except on legal obligations, any information
        regarding the Company&apos;s affairs or administration or research carried out, whether the
        same is confided to you or becomes known to you in the course of your service or otherwise.
        You will need to sign a Non- Disclosure Agreement (NDA) with the company. All intellectual
        property rights, including designs, source code, project details, and any other work related
        to your assigned tasks, will be owned by <strong>{data.companyName}.</strong>
      </p>

      <p className={styles.sectionHeading}>9. Intellectual Property:</p>
      <p className={styles.tightParagraph}>
        If you conceive any new or advanced method of improving designs/ processes/ formulae/
        systems, etc. in relation to the business/ operations of the Company, such developments will
        be fully communicated to the company and will be, and remain, the sole right/ property of
        the Company.
      </p>

      <p className={styles.sectionHeading}>10. Termination of employment:</p>
      <p className={styles.tightParagraph}>
        During the probationary period and any extension thereof, your services may be terminated
        without giving any notice or salary in lieu thereof. However, on confirmation the services
        can be terminated from either side by giving three month (90 days) notice or salary in lieu
        thereof.
      </p>
      <p className={styles.tightParagraph}>
        Upon resignation/termination of employment, you will immediately hand over to the Company
        all correspondence, specifications, formulae, documents, market data, cost data, drawings,
        affects or records belonging to the Company or relating to its business and shall not retain
        or make copies of these items.
      </p>
      <p className={styles.tightParagraph}>
        Upon resignation/termination of employment, you will also return all company property, which
        may be in your possession. Not with standing the above condition, the contract of service
        may also be terminated because of under mentioned stipulations. This will be without payment
        of any compensation
      </p>
      <ul className={styles.bulletList}>
        <li>
          If you fail, refuse or neglect to carry out and perform your duties assigned to you by the
          company.
        </li>
        <li>For loss of confidence in you by the company for any of the act committed by you.</li>
        <li>
          If you are found to be guilty of fraud, insubordination or misconduct whether in course of
          performance of duties entrusted to you or otherwise.
        </li>
        <li>If you commit breach of any of the terms of this Employment offer letter.</li>
      </ul>

      <p className={styles.sectionHeading}>11. Authority:</p>
      <p className={styles.tightParagraph}>
        No authority is vested upon you to make any financial commitment and enter into agreements/
        contracts/ understandings of any nature with any second party and third party without
        seeking the prior permission/approval of the management. Any violation to exceed your
        specified authority as mentioned will be seriously viewed and disciplinary/ appropriate
        legal action will be taken.
      </p>

      <p className={styles.tightParagraph}>
        <strong>12.</strong> Please find the Salary Calculation that reflect in your Salary from{" "}
        <strong className={styles.numeric}>{data.salaryEffectiveDate}</strong>.
      </p>

      <table className={styles.offerTable}>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td>
              <strong>Rs. {data.basic}</strong>
            </td>
          </tr>
          <tr>
            <td>Loyalty Bonus ({data.loyaltyBonusRate}% of Total Salary)</td>
            <td>
              <strong>Rs. {data.loyaltyBonus}</strong>
            </td>
          </tr>
          <tr>
            <td>Total Monthly Salary</td>
            <td>
              <strong>Rs. {data.totalMonthly}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.tightParagraph}>
        Please sign the enclosed copy of this letter and return it to us to indicate your acceptance
        of this offer. We are confident you will be able to make a significant contribution to the
        success of <strong>{data.companyName}</strong> and look forward to working with you.
      </p>
      <p className={styles.tightParagraph}>
        I, <strong>{data.candidateName}</strong> accept and agree to the proposed terms of
        employment and request to please prepare a formal contract of employment for execution.
      </p>

      <SignatureBlock signOff="Sincerely," splitTitle showSignatory={false} signSpace />
    </div>
  );

  return <LetterPages pages={[page1, page2]} />;
}
