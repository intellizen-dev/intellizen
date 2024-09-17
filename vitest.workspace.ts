import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      typecheck: {
        enabled: true,
      },
    },
  },
  'packages/*',
])
