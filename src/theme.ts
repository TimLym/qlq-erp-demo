export type ThemeId = 'teal' | 'blue' | 'dark' | 'contrast'

export interface ThemeDef {
  id: ThemeId
  label: string
  note: string
  dark: boolean
  /** 設定頁色票 */
  swatch: { paper: string; surface: string; accent: string; ink: string }
  /** AG Grid 主題參數 */
  grid: {
    accentColor: string
    backgroundColor: string
    foregroundColor: string
    headerTextColor: string
    headerBackgroundColor: string
    borderColor: string
    rowHoverColor: string
    selectedRowBackgroundColor: string
  }
}

export const themes: ThemeDef[] = [
  {
    id: 'teal',
    label: '青色亮',
    note: '預設。冷灰底、深青主色，數字與狀態色最分明。',
    dark: false,
    swatch: { paper: '#f3f4f1', surface: '#ffffff', accent: '#0f5c5a', ink: '#16211b' },
    grid: {
      accentColor: '#0f5c5a', backgroundColor: '#ffffff', foregroundColor: '#16211b',
      headerTextColor: '#5b6770', headerBackgroundColor: '#f3f4f1', borderColor: '#d6dad4',
      rowHoverColor: '#f3f4f1', selectedRowBackgroundColor: '#dcecea',
    },
  },
  {
    id: 'blue',
    label: '藍色亮',
    note: '接近現行系統的藍色，給習慣舊介面的同事。',
    dark: false,
    swatch: { paper: '#f2f4f7', surface: '#ffffff', accent: '#2f5d8a', ink: '#1a2530' },
    grid: {
      accentColor: '#2f5d8a', backgroundColor: '#ffffff', foregroundColor: '#1a2530',
      headerTextColor: '#5a6873', headerBackgroundColor: '#f2f4f7', borderColor: '#d3d9e0',
      rowHoverColor: '#f2f4f7', selectedRowBackgroundColor: '#e2eaf2',
    },
  },
  {
    id: 'dark',
    label: '暗色',
    note: '長時間看表格的人用，降低亮度但保留狀態色。',
    dark: true,
    swatch: { paper: '#121a1f', surface: '#1a252c', accent: '#5fb3ae', ink: '#e3eae8' },
    grid: {
      accentColor: '#5fb3ae', backgroundColor: '#1a252c', foregroundColor: '#e3eae8',
      headerTextColor: '#97a5ad', headerBackgroundColor: '#121a1f', borderColor: '#2b3a42',
      rowHoverColor: '#22303a', selectedRowBackgroundColor: '#1f3a3a',
    },
  },
  {
    id: 'contrast',
    label: '高對比',
    note: '純白底、黑字、粗邊框，投影或視力需求時用。',
    dark: false,
    swatch: { paper: '#ffffff', surface: '#ffffff', accent: '#003f3d', ink: '#000000' },
    grid: {
      accentColor: '#003f3d', backgroundColor: '#ffffff', foregroundColor: '#000000',
      headerTextColor: '#000000', headerBackgroundColor: '#eeeeee', borderColor: '#555555',
      rowHoverColor: '#f0f0f0', selectedRowBackgroundColor: '#cfe6e4',
    },
  },
]

export const THEME_KEY = 'erp.theme'

export function readSavedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemeId | null
    if (v && themes.some((t) => t.id === v)) return v
  } catch {
    /* 私密視窗或封鎖儲存時忽略 */
  }
  return 'teal'
}

export function applyTheme(id: ThemeId) {
  const def = themes.find((t) => t.id === id) ?? themes[0]!
  const root = document.documentElement
  root.dataset.theme = def.id
  root.classList.toggle('dark', def.dark)
  try {
    localStorage.setItem(THEME_KEY, def.id)
  } catch {
    /* ignore */
  }
}
