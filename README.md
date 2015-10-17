# async-context
A trial for an easy way to write async codes

# Use
```typescript
// ES6
function asyncFoo() {
  return new AsyncContext((context) => {
    context
      .queue(bar)
      .queue(baz)
      .queue(() => context.resolve());
  }).feed();
}
let foo = asyncFoo();
foo.cancel();

// ES7
function asyncFoo() {
  return new AsyncContext((context) => {
    await context.queue(bar);
    await context.queue(baz);
    context.resolve();
  }).feed();
}
let foo = asyncFoo();
foo.cancel();
```
