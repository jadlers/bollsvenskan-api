import Prometheus from "prom-client";
import onFinished from "on-finished";

Prometheus.collectDefaultMetrics();

/*
 * Use this endpoint to expose the data collected and hook up to grafana
 */
export function monitoringEndpoint(_, res) {
  res.set("Content-Type", Prometheus.register.contentType);
  res.end(Prometheus.register.metrics());
}

const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000],
});

const httpRequestTotal = new Prometheus.Counter({
  name: "http_request_total",
  help: "Number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"],
});

const monitoring = (req, res, next) => {
  res.locals.startEpoch = Date.now(); // Start timer

  onFinished(res, (err, res) => {
    console.log("monitoring finishing res");
    const responseTimeInMs = Date.now() - res.locals.startEpoch;
    httpRequestDurationMicroseconds
      .labels(req.method, req.path, res.statusCode)
      .observe(responseTimeInMs);

    httpRequestTotal.labels(req.method, req.path, res.statusCode).inc();
  });

  next();
};

export default monitoring;
