import morgan from "morgan";

morgan.token("post-body", (req, _) =>
  req.method === "POST" ? JSON.stringify(req.body) : ""
);

const logger = morgan("[:date[iso]] :status :method :url :post-body", {
  skip: (req, _) => req.path === "/metrics",
});

export default logger;
