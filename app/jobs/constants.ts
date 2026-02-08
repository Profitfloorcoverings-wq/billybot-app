export const JOB_STATUS_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Awaiting info", value: "awaiting_info" },
  { label: "Quoted", value: "quoted" },
  { label: "Approved", value: "approved" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export const JOB_STATUS_FILTERS = [
  { label: "All", value: "all" },
  ...JOB_STATUS_OPTIONS,
];
