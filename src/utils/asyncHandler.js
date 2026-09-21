// Wraps an async controller so rejected promises are passed to Express's error handler
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
