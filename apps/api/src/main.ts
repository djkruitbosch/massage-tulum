name: Claude PR Review

on:
  pull_request:
    types:
      - opened
      - synchronize
      - reopened

permissions:
  contents: read
  pull-requests: write
  issues: write
  id-token: write

jobs:
  review:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Run Claude review
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true

          prompt: |
            You are a senior code reviewer.

            Review ONLY the changes in this pull request.

            You must inspect the PR diff and leave GitHub PR review comments.

            Flag:
            - bugs
            - security issues
            - missing tests
            - type issues
            - dangerous patterns

            Keep feedback terse.
            Max 5 findings.

            If you find no issues, leave one short PR comment saying:
            "Claude reviewed this PR and found no blocking issues."