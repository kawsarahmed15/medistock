export function notFoundHandler(_req, _res, next) {
  const error = new Error("Not found");
  error.status = 404;
  next(error);
}

export function errorHandler(err, _req, res, _next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const message = status >= 500 ? "Internal server error" : err.message;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ message });
}
