export const SIDEBAR_DEFAULT_OPEN = false;

export type SidebarVisualState = "expanded" | "collapsed";

export function getSidebarPresentation(state: SidebarVisualState) {
  const isCollapsed = state === "collapsed";
  return {
    isCollapsed,
    navLabelsHidden: isCollapsed,
    widthMode: isCollapsed ? "icon" : "full",
  } as const;
}
