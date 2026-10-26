import type { ReactNode } from 'react'
import {
  Calendar, Clipboard, Archive, BarChart, Users, Dollar,
  ChartTrendingUp, ChartPie, ChartActivity, Gauge, Sparkles, GitBranch,
  Sun, LockClosed, RefreshClockwise, Shield, Layout, SettingsGear, Grid,
} from './icons/geist'

export const ICON_SIZE = 18

export const PATH_ICONS: Record<string, ReactNode> = {
  '/': <Calendar size={ICON_SIZE} />,
  '/projects': <Clipboard size={ICON_SIZE} />,
  '/projects/archive': <Archive size={ICON_SIZE} />,
  '/projects/kanban': <Layout size={ICON_SIZE} />,
  '/consultants': <Users size={ICON_SIZE} />,
  '/consultants/archive': <Archive size={ICON_SIZE} />,
  '/revenue': <Dollar size={ICON_SIZE} />,
  '/historicals': <ChartTrendingUp size={ICON_SIZE} />,
  '/capacity': <ChartPie size={ICON_SIZE} />,
  '/margin': <ChartActivity size={ICON_SIZE} />,
  '/utilization': <Gauge size={ICON_SIZE} />,
  '/skills': <Sparkles size={ICON_SIZE} />,
  '/mentor-tree': <GitBranch size={ICON_SIZE} />,
  '/holidays': <Sun size={ICON_SIZE} />,
  '/permissions': <LockClosed size={ICON_SIZE} />,
  '/sync-log': <RefreshClockwise size={ICON_SIZE} />,
  '/security': <Shield size={ICON_SIZE} />,
}

export const GROUP_ICONS: Record<string, ReactNode> = {
  Projects: <Clipboard size={ICON_SIZE} />,
  Consultants: <Users size={ICON_SIZE} />,
  Dashboards: <BarChart size={ICON_SIZE} />,
  Workspace: <Grid size={ICON_SIZE} />,
  Admin: <SettingsGear size={ICON_SIZE} />,
}
