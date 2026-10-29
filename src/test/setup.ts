// Tests must never reach the network (and never spend Google quota).
// Any test that needs fetch passes an explicit mock.
globalThis.fetch = () => {
  throw new Error("Real network access is blocked in tests. Pass a mock fetchFn.");
};
