/** Inline icon set — 16px stroke icons, no external dependency. */

const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round'
};

const make = (paths) => function Icon(props) {
  return <svg {...base} {...props}>{paths}</svg>;
};

export const IconDashboard = make(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>);
export const IconDocument = make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>);
export const IconWand = make(<><path d="M15 4V2M15 10V8M12.5 6h-2M19.5 6h-2M13.2 8.8 12 10M17.8 3.2 16.6 4.4" /><path d="M3 21l9-9" /><path d="M11.5 9.5l3 3" /></>);
export const IconUsers = make(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const IconGrid = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>);
export const IconShield = make(<><path d="M12 3l8 3v6c0 4.5-3.2 8.6-8 10-4.8-1.4-8-5.5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>);
export const IconLayers = make(<><path d="M12 2 2 7l10 5 10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>);
export const IconLink = make(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>);
export const IconArchive = make(<><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>);
export const IconChart = make(<><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>);
export const IconSettings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6 1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>);
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconUpload = make(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 9l5-5 5 5M12 4v12" /></>);
export const IconDownload = make(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 11l5 5 5-5M12 16V4" /></>);
export const IconCheck = make(<path d="m5 13 4 4L19 7" />);
export const IconX = make(<path d="M18 6 6 18M6 6l12 12" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconChevronRight = make(<path d="m9 18 6-6-6-6" />);
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const IconChevronLeft = make(<path d="m15 18-6-6 6-6" />);
export const IconArrowDown = make(<path d="M12 5v14M19 12l-7 7-7-7" />);
export const IconArrowRight = make(<path d="M5 12h14M12 5l7 7-7 7" />);
export const IconAlert = make(<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>);
export const IconInfo = make(<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>);
export const IconClock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconEdit = make(<><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6l-4 1 1-4z" /></>);
export const IconTrash = make(<><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></>);
export const IconEye = make(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>);
export const IconFilter = make(<path d="M3 4h18l-7 8v7l-4 2v-9z" />);
export const IconRefresh = make(<><path d="M20 11A8 8 0 0 0 6 5.3L3 8" /><path d="M4 13a8 8 0 0 0 14 5.7l3-2.7" /><path d="M3 4v4h4M21 20v-4h-4" /></>);
export const IconSun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = make(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const IconLogout = make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>);
export const IconMenu = make(<path d="M3 6h18M3 12h18M3 18h18" />);
export const IconLock = make(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconFlow = make(<><rect x="3" y="3" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><rect x="9" y="9.5" width="6" height="5" rx="1" /><path d="M9 5.5h2a1 1 0 0 1 1 1v3M15 18.5h-2a1 1 0 0 1-1-1v-3" /></>);
export const IconBook = make(<><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" /><path d="M8 7h7M8 11h7" /></>);
export const IconTarget = make(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>);
export const IconSparkles = make(<><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>);
export const IconCopy = make(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const IconSave = make(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>);
export const IconComment = make(<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />);
export const IconHistory = make(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>);
export const IconBuilding = make(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></>);
export const IconBell = make(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const IconInbox = make(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" /></>);
