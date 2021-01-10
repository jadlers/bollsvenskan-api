import morgan from "morgan";

morgan.token("post-body", (req, _) =>
  req.method === "POST" ? JSON.stringify(req.body) : ""
);

morgan.token("authorized-user", (req, _) =>
  req.authorizedUser ? `authUser(${req.authorizedUser})` : "noAuth"
);

const logger = morgan(
  "[:date[iso]] :status :method :url :authorized-user :post-body",
  {
    skip: (req, _) => req.path === "/metrics",
  }
);

export default logger;
