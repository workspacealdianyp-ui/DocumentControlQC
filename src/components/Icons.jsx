// Minimal inline SVG icon set (WCAG: status is icon + label, never color alone)
const I = ({ children, size = 14, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
)

export const IconCheck = (p) => <I {...p}><polyline points="20 6 9 17 4 12" /></I>
export const IconClock = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></I>
export const IconAlert = (p) => <I {...p}><path d="M12 3 2 21h20L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17.5" x2="12.01" y2="17.5" /></I>
export const IconDash = (p) => <I {...p}><line x1="6" y1="12" x2="18" y2="12" /></I>
export const IconNa = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><line x1="6" y1="18" x2="18" y2="6" /></I>
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></I>
export const IconGrid = (p) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></I>
export const IconList = (p) => <I {...p}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></I>
export const IconFile = (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></I>
export const IconGear = (p) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></I>
export const IconBack = (p) => <I {...p}><polyline points="15 18 9 12 15 6" /></I>
export const IconPlus = (p) => <I {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></I>
export const IconTrash = (p) => <I {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></I>
export const IconDownload = (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></I>
export const IconPrint = (p) => <I {...p}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></I>
export const IconUser = (p) => <I {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></I>
export const IconLogout = (p) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></I>
export const IconPen = (p) => <I {...p}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></I>
export const IconEye = (p) => <I {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></I>
export const IconShield = (p) => <I {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></I>

export const IconMenu = (p) => <I {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></I>
export const IconHome = (p) => <I {...p}><path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" /><polyline points="9 21.5 9 13 15 13 15 21.5" /></I>
export const IconBell = (p) => <I {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></I>
export const IconCloudUp = (p) => <I {...p}><path d="M4 16.2A4.5 4.5 0 0 1 6.1 8h.9a6 6 0 0 1 11.6 2.1A3.9 3.9 0 0 1 18 17.5H7" /><polyline points="9 13 12 10 15 13" /><line x1="12" y1="10" x2="12" y2="19" /></I>
export const IconCloudOff = (p) => <I {...p}><path d="M4 16.2A4.5 4.5 0 0 1 6.1 8h.9a6 6 0 0 1 9.3-1.5M19.6 10.5A3.9 3.9 0 0 1 18 17.5H8" /><line x1="3" y1="3" x2="21" y2="21" /></I>
export const IconApprove = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9.5" /></I>
export const IconDoc = (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></I>
export const IconChevronR = (p) => <I {...p}><polyline points="9 18 15 12 9 6" /></I>

export const STATUS_ICONS = {
  done: IconCheck,
  inprogress: IconClock,
  notstarted: IconDash,
  overdue: IconAlert,
  na: IconNa,
}

// Sidebar collapse control: a panel with its rail filled, which is what
// the control actually does, unlike a hamburger.
export const IconPanel = (p) => <I {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></I>
export const IconChevronD = (p) => <I {...p}><polyline points="6 9 12 15 18 9" /></I>
