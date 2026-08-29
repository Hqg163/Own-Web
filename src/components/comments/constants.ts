export interface CommentSortOption { value: string; label: string }

export const defaultCommentSortOptions: CommentSortOption[] = [
  { value: 'newest', label: '最新' },
  { value: 'oldest', label: '最早' },
  { value: 'popular', label: '最热门' },
]

export interface EmojiCategory { key: string; label: string; emojis: string[] }

export const defaultEmojiCategories: EmojiCategory[] = [
  { key: 'frequent', label: '常用', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤔', '🤗', '😎', '😢', '😭', '😡', '😴', '🤝', '👏', '🙌', '👍', '👎', '❤️', '✨', '🔥', '🎉'] },
  { key: 'people', label: '人物', emojis: ['👋', '🤲', '👐', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '🙏', '💪', '🧑', '👩', '👨', '🧒'] },
  { key: 'animals', label: '动物', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝'] },
  { key: 'food', label: '食物', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🍅', '🥑', '🍞', '🧀', '🍔', '🍕', '🍰'] },
  { key: 'activities', label: '活动', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏆', '🎮', '🎨', '🎤', '🎵', '🎬', '🎁', '✈️', '🚗', '🚀', '🏖️', '🎉', '🎊'] },
  { key: 'objects', label: '物品', emojis: ['☕', '🍵', '📚', '✏️', '💡', '📌', '📷', '💻', '📱', '⌚', '🔒', '🔑', '📝', '📎', '🖼️', '💬', '💭', '🧠'] },
  { key: 'symbols', label: '符号', emojis: ['💯', '‼️', '⁉️', '❓', '❗', '⭕', '➕', '➖', '✔️', '❎', '⚡', '☀️', '🌙', '❤️', '💙', '💚', '🧡', '💜'] },
]
