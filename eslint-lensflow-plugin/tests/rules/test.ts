type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;
