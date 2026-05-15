"use client";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-provider";

const rows = [
  {
    id: "1",
    name: "Neha Kapoor",
    role: "Engineer",
    status: "Active",
    location: "HQ",
  },
  {
    id: "2",
    name: "Rahul Mehta",
    role: "HR Business Partner",
    status: "Active",
    location: "HQ",
  },
  {
    id: "3",
    name: "Asha Verma",
    role: "Super Admin",
    status: "Active",
    location: "Remote",
  },
];

export default function EmployeeDirectoryPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <PageHeader
        title="All Employees"
        description="View and manage all employees in the organization."
        actions={
          (user?.role === "hr" || user?.role === "super_admin") && (
            <Button variant="secondary" size="sm">
              Add employee
            </Button>
          )
        }
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "name", header: "Name" },
          { key: "role", header: "Role" },
          {
            key: "status",
            header: "Status",
            render: (r) => <Badge variant="success">{r.status}</Badge>,
          },
          { key: "location", header: "Location" },
        ]}
      />
    </div>
  );
}
