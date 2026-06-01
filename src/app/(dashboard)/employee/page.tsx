"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Pencil, Search, User } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-provider";
import { DEFAULT_PAGE_SIZE, pickSheetRowFields, resolveProfileImageSrc } from "@/lib/employee";
import { Input } from "@/components/ui/input";
import { ROLES, STATUS } from "@/app/consts/common";
import { EMPLOYEE_LIST_COLUMNS } from "@/app/consts/employee-list";
import { Select } from "@/components/ui/select";

import type { EmployeeRow } from "@/types/employee";
import type { SheetPagination } from "@/types/sheet";
import type { Column, SortOrder } from "@/types/table";

const emptyPagination: SheetPagination = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const LIST_FIELD_KEYS = EMPLOYEE_LIST_COLUMNS.map((column) => column.key);

function buildListColumns(canManage: boolean): Column<EmployeeRow>[] {
  const tableColumns: Column<EmployeeRow>[] = EMPLOYEE_LIST_COLUMNS.map(
    ({ key, header, sortable }) => ({
      key,
      header,
      sortable,
      ...(key === "profileImage" && {
        render: (row: EmployeeRow) => {
          const src = resolveProfileImageSrc(row.profileImage);
          if (!src) {
            return (
              <span
                className="border-ex-border bg-ex-surface text-ex-muted inline-flex size-10 items-center justify-center rounded-full border"
                aria-label="No profile photo"
              >
                <User className="size-5" />
              </span>
            );
          }
          return (
            <Image
              src={src}
              alt="Profile"
              width={40}
              height={40}
              unoptimized
              className="border-ex-border size-10 rounded-full border object-cover"
            />
          );
        },
      }),
      ...(key === "status" && {
        render: (row: EmployeeRow) => (
          <Badge variant={row.status === STATUS.ACTIVE ? "success" : "danger"}>{row.status}</Badge>
        ),
      }),
      ...(key === "role" && {
        render: (row: EmployeeRow) => (
          <span className="capitalize">{row.role.split("_").join(" ")}</span>
        ),
      }),
      ...(key === "position" && {
        render: (row: EmployeeRow) => (
          <span className="capitalize">{row.position.split("_").join(" ")}</span>
        ),
      }),
      ...(key === "contactNumber" && {
        render: (row: EmployeeRow) => (
          <span className="capitalize">
            +91 {row.contactNumber.replace(/(\d{5})(\d{5})/, "$1 $2")}
          </span>
        ),
      }),
    }),
  );

  if (!canManage) {
    return tableColumns;
  }

  return [
    ...tableColumns,
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      sticky: "right",
      className: "min-w-[9rem]",
      render: (row: EmployeeRow) => (
        <div className="flex items-center gap-1">
          <Link href={`/employee/${row.id}/profile`}>
            <Button variant="ghost" size="sm" type="button">
              <Eye className="size-3.5" />
              View
            </Button>
          </Link>
          <Link href={`/employee/${row.id}/edit`}>
            <Button variant="ghost" size="sm" type="button">
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </Link>
        </div>
      ),
    },
  ];
}

export default function EmployeeDirectoryPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column<EmployeeRow>[]>([]);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState<SheetPagination>(emptyPagination);

  const canManage = user?.role === ROLES.HR_MANAGER || user?.role === ROLES.SUPER_ADMIN;
  const effectiveStatusFilter = !canManage && statusFilter === STATUS.INACTIVE ? "" : statusFilter;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          sortBy,
          order: sortOrder,
          page: String(page),
          pageSize: String(DEFAULT_PAGE_SIZE),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (effectiveStatusFilter) params.set("status", effectiveStatusFilter);
        const response = await fetch(`/api/employee?${params}`);
        const result = await response.json();

        if (cancelled) return;

        if (result.success) {
          const sheetData = result.data || [];
          const headers = (sheetData[0] as string[]) ?? [];
          const dataRows = sheetData.slice(1);
          const pageInfo: SheetPagination = result.pagination ?? emptyPagination;
          const sheetRows: number[] = result.sheetRows ?? [];

          const formattedData = dataRows.map((row: string[], index: number) => ({
            id: String(sheetRows[index] ?? index + 1),
            ...pickSheetRowFields(headers, row, LIST_FIELD_KEYS),
          })) as EmployeeRow[];

          setColumns(buildListColumns(canManage));
          setRows(formattedData);
          setPagination(pageInfo);
        }
      } catch (error) {
        if (!cancelled) console.error("Fetch Employee Error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sortBy, sortOrder, page, debouncedSearch, effectiveStatusFilter, canManage]);

  const handleSort = (key: string) => {
    setPage(1);
    if (sortBy === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="All Employees"
        description="View and manage all employees in the organization."
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative max-w-md flex-1">
            <Search className="text-ex-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, or tech skills…"
              className="pl-9"
              aria-label="Search employees"
            />
          </div>

          {canManage ? (
            <div className="w-full space-y-2 sm:w-44">
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value={STATUS.ACTIVE}>{STATUS.ACTIVE}</option>
                <option value={STATUS.INACTIVE}>{STATUS.INACTIVE}</option>
              </Select>
            </div>
          ) : null}
        </div>

        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
      </div>
    </div>
  );
}
