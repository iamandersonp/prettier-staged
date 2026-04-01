# preetier-staged

An utitlty to auto format stagged files using prettier

## Instalation

To use as a dev dependency

```bash
npm i -D preetier-staged
```

To use as a global

```bash
npm i -g preetier-staged
```

## Setup

By default preetier-stagged will check stagged files, so it's recommended to set up the pre-commit git hook

This is an example of a posible implementation. In this example we skip the execution of command if there is a merge in progress

```bash
#!/bin/sh
#

if git ls-files -u | grep -q .; then
echo "⚠️  Merge in progress with conflicts. Skipping Prettier to avoid issues."
  exit 0
fi

prettier-staged

STAGED_FILES=$(git diff --name-only --cached --diff-filter=ACM | grep -E '\.(html|ts|scss|css|json)$')

if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | xargs git add
fi
```
