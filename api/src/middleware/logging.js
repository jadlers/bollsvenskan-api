import morgan from "morgan";

morgan.token("post-body", (req, _) =>
  ["POST", "PUT"].includes(req.method) ? JSON.stringify(req.body) : ""
);

morgan.token("authorized-user", (_req, res) => {
  const user = res.locals.user;
  return user ? `authUser(${user.username})` : "noAuth";
});

const logger = morgan(
  "[:date[iso]] :status :method :url :authorized-user :post-body",
  {
    skip: (req, _) => req.path === "/metrics",
  }
);

export default logger;
