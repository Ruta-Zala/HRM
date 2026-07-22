export type CompanyHolidayType = "leave" | "celebration";

export type CompanyHoliday = {
  id: string;
  date: string;
  name: string;
  type: CompanyHolidayType;
};

export const COMPANY_HOLIDAYS_2026: CompanyHoliday[] = [
  { id: "2026-01-14", date: "2026-01-14", name: "Makar Sankranti", type: "leave" },
  { id: "2026-01-26", date: "2026-01-26", name: "Republic Day", type: "celebration" },
  { id: "2026-03-03", date: "2026-03-03", name: "Holi", type: "celebration" },
  { id: "2026-03-04", date: "2026-03-04", name: "Dhuleti", type: "leave" },
  { id: "2026-08-15", date: "2026-08-15", name: "Independence Day", type: "celebration" },
  { id: "2026-08-28", date: "2026-08-28", name: "Raksha Bandhan", type: "leave" },
  { id: "2026-09-04", date: "2026-09-04", name: "Janmashtami", type: "leave" },
  { id: "2026-09-14", date: "2026-09-14", name: "Ganesh Chaturthi", type: "celebration" },
  { id: "2026-10-21", date: "2026-10-21", name: "Vijaya Dashami", type: "leave" },
  { id: "2026-11-08", date: "2026-11-08", name: "Diwali", type: "leave" },
  { id: "2026-11-10", date: "2026-11-10", name: "New Year", type: "leave" },
  { id: "2026-11-11", date: "2026-11-11", name: "Bhai Dooj", type: "leave" },
  { id: "2026-12-25", date: "2026-12-25", name: "Christmas Day", type: "celebration" },
];
