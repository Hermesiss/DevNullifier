import type { CacheCategory } from '@/types'

/** Muted badge colors — readable on light and dark tonal chips */
const colors: Record<CacheCategory, string> = {
    'Python': '#3D8B6E',
    'Node.js / JS / TS': '#C47A2C',
    'Rust': '#C46B3A',
    'Java / Kotlin / Android': '#B85C5C',
    '.NET / C#': '#6B6AAD',
    'C/C++': '#4A7BB8',
    'Xcode / iOS / macOS': '#4A9BAA',
    'Unity': '#5B6B9A',
    'Unreal Engine': '#A85A72',
    'PHP / Laravel': '#7A5FA8',
    'Symfony': '#6B5B95',
    'ML / Data Science': '#3D8A8A',
    'Docker / DevOps': '#5A6B7A',
    'Static Site Generators': '#5A8A5A',
    'Testing Tools': '#B89A3D',
    'IDEs / Editors': '#7A6A5A'
}

export const getTypeColor = (type: CacheCategory): string => {
    return colors[type] || '#73777E'
}
