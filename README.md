# Introduction

This is a webpack loader that takes decorators with inline function declarations and hoists the functions into the toplevel module scope, adding an `export` keyword as well.

For example, a file like:

```typescript
class Foo {
  @select(s => s.foo.bar) myProperty;
}
```

Becomes:

```typescript
export function stateSelector_8fcd(s) {
  return s.foo.bar;
}

class Foo {
  @select(stateSelector_8fcd) myProperty;
}

```

This is to work around issues with the Angular AoT compiler. Once they stop complaining about non-exported functions, then this loader can be deprecated.
