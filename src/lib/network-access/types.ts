export type OfficeNetwork = {
  id: string;
  label: string;
  ip: string;
  createdAt: string;
  updatedAt: string;
};

export type RemoteAccessEmployee = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  createdAt: string;
};

export type NetworkAccessSettings = {
  restrictionEnabled: boolean;
};

export type NetworkAccessDecision = {
  allowed: boolean;
  reason:
    | "restriction_disabled"
    | "admin_bypass"
    | "remote_exempt"
    | "office_ip"
    | "blocked"
    | "unauthenticated";
  clientIp: string;
};
