"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

const slips = [
  { id: "1", month: "Apr 2026", gross: "₹1,24,000", net: "₹98,400", status: "Released" },
  { id: "2", month: "Mar 2026", gross: "₹1,22,500", net: "₹97,200", status: "Released" },
];

export default function SalarySlipsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Salary slips"
        description="Encrypted PDF distribution with per-employee access. Hook generation to payroll + Drive archival."
        actions={<Button variant="outline">Download ZIP (HR)</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <DataTable
            rows={slips}
            columns={[
              { key: "month", header: "Pay period" },
              { key: "gross", header: "Gross" },
              { key: "net", header: "Net pay" },
              { key: "status", header: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
