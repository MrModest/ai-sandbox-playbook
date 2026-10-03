# Global Claude Code Instructions

## Code Quality & Style
- Keep code simple and maintainable - avoid enterprise patterns unless truly needed
- No premature optimizations or overengineering
- Use context7 to verify latest documentation for frameworks/libraries before implementation
- Follow existing project conventions (check CLAUDE.md, existing code patterns)

## Communication Style
- Be concise and direct - minimal explanatory text
- No excessive validation or compliments
- Focus on facts and solutions over agreement
- Use emojis only when explicitly requested

## Task Execution
- Read relevant files before editing (understand context first)
- Use parallel tool calls for independent operations
- Mark todos complete immediately after finishing each task
- Ask clarifying questions upfront rather than making assumptions

## Common Patterns to Avoid
- Don't create new files when editing existing ones works
- Don't add comments explaining obvious code
- Don't refactor working code unless asked
- Don't add error handling "just in case" - add it when needed

## Tools
- Whenever you need to call `npm` command, use `pnpm` alternative instead
