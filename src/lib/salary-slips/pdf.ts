import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type SlipPdfInput = {
  companyName: string;
  companyAddress: string;
  payTitle: string;
  payRange: string;
  employeeName: string;
  employeeCode: string;
  fatherName: string;
  pan: string;
  bankAccountNo: string;
  designation: string;
  ifsc: string;
  netPayableDays: number;
  aadharNo: string;
  workingDays: number;
  basic: number;
  hra: number;
  organisationAllowance: number;
  loyaltyBonusRate?: number;
  loyaltyBonus: number;
  professionalTax: number;
  lwf: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  amountInWords: string;
};

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function renderSalarySlipPdf(input: SlipPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lineColor = rgb(0.2, 0.2, 0.2);

  const drawText = (text: string, x: number, y: number, size = 10, isBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };
  const drawRect = (x: number, y: number, w: number, h: number) => {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: lineColor, borderWidth: 1 });
  };
  const top = 780;

  drawText(input.companyName, 240, top, 14, true);
  drawText(input.companyAddress, 130, top - 16, 10);
  drawText(input.payTitle, 190, top - 48, 13, true);
  drawText(input.payRange, 205, top - 66, 11, true);

  drawRect(40, top - 265, 515, 128);
  const leftX = 46;
  const rightX = 340;
  let y = top - 158;
  const lineH = 23;
  const row = (label: string, value: string, rxLabel: string, rxValue: string) => {
    drawText(label, leftX, y, 10);
    drawText(`: ${value || "-"}`, leftX + 115, y, 10, true);
    drawText(rxLabel, rightX, y, 10);
    drawText(`: ${rxValue || "-"}`, rightX + 110, y, 10, true);
    y -= lineH;
  };
  row("Employee Name", input.employeeName, "Employee Code", input.employeeCode);
  row("Father's Name", input.fatherName, "PAN", input.pan);
  row("Bank A/c No.", input.bankAccountNo, "Designation", input.designation);
  row("IFSC", input.ifsc, "Net Payable Days", String(input.netPayableDays));
  row("Aadhar No.", input.aadharNo, "Working Days", String(input.workingDays));

  const tableTop = top - 280;
  drawRect(40, tableTop - 190, 515, 190);
  page.drawLine({
    start: { x: 242, y: tableTop },
    end: { x: 242, y: tableTop - 190 },
    thickness: 1,
    color: lineColor,
  });
  page.drawLine({
    start: { x: 307, y: tableTop },
    end: { x: 307, y: tableTop - 190 },
    thickness: 1,
    color: lineColor,
  });
  page.drawLine({
    start: { x: 498, y: tableTop },
    end: { x: 498, y: tableTop - 190 },
    thickness: 1,
    color: lineColor,
  });
  page.drawLine({
    start: { x: 40, y: tableTop - 34 },
    end: { x: 555, y: tableTop - 34 },
    thickness: 1,
    color: lineColor,
  });
  page.drawLine({
    start: { x: 40, y: tableTop - 120 },
    end: { x: 555, y: tableTop - 120 },
    thickness: 1,
    color: lineColor,
  });
  page.drawLine({
    start: { x: 40, y: tableTop - 162 },
    end: { x: 555, y: tableTop - 162 },
    thickness: 1,
    color: lineColor,
  });

  drawText("Earnings", 44, tableTop - 22, 11, true);
  drawText("Amount Rs.", 255, tableTop - 16, 10, true);
  drawText("Deductions", 315, tableTop - 22, 11, true);
  drawText("Amount Rs.", 507, tableTop - 16, 10, true);

  drawText("BASIC SALARY", 44, tableTop - 48, 11);
  drawText(money(input.basic), 257, tableTop - 48, 11);
  const loyaltyLabel = `LOYALTY BONUS (${Math.round(input.loyaltyBonusRate ?? 10)}%)`;
  drawText(loyaltyLabel, 315, tableTop - 48, 11);
  drawText(money(input.loyaltyBonus), 507, tableTop - 48, 11);

  drawText("HRA", 44, tableTop - 76, 11);
  drawText(money(input.hra), 257, tableTop - 76, 11);
  drawText("PROFESSIONAL TAX", 315, tableTop - 76, 11);
  drawText(money(input.professionalTax), 507, tableTop - 76, 11);

  drawText("ORGANISATION ALLOWANCE", 44, tableTop - 104, 11);
  drawText(money(input.organisationAllowance), 257, tableTop - 104, 11);
  drawText("LWF", 315, tableTop - 104, 11);
  drawText(money(input.lwf), 507, tableTop - 104, 11);

  drawText("Total Earnings", 44, tableTop - 145, 11, true);
  drawText(money(input.totalEarnings), 245, tableTop - 145, 11, true);
  drawText("Total Deductions", 315, tableTop - 145, 11, true);
  drawText(money(input.totalDeductions), 498, tableTop - 145, 11, true);

  drawText(`Net Pay      : Rs. ${money(input.netPay)}`, 44, tableTop - 180, 12, true);
  drawText(`In Words    : Rs. ${input.amountInWords} only`, 44, tableTop - 205, 11, true);
  drawText(
    "This is Computer Generated Sheet, does not require Signature.",
    44,
    tableTop - 238,
    11,
    true,
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
