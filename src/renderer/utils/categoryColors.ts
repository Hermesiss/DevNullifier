import type { CacheCategory } from '@/types'

export const getTypeColor = (type: CacheCategory): string => {
    const colors: Record<CacheCategory, string> = {
        'Python': 'green',
        'Node.js / JS / TS': 'orange',
        'Rust': 'orange',
        'Java / Kotlin / Android': 'red',
        '.NET / C#': 'purple',
        'C/C++': 'blue',
        'Xcode / iOS / macOS': 'cyan',
        'Unity': 'indigo',
        'Unreal Engine': 'pink',
        'PHP / Laravel': 'purple',
        'Symfony': 'deep-purple',
        'ML / Data Science': 'teal',
        'Docker / DevOps': 'blue-grey',
        'Static Site Generators': 'light-green',
        'Testing Tools': 'amber',
        'IDEs / Editors': 'brown'
    }
    return colors[type] || 'grey'
} 