# Monitoring

The Container Apps environment sends container stdout to the Log Analytics
workspace `sdd-3b-g7-logs`. Both services emit one INFO request line in this
format:

```text
method=GET path=/items status=200 duration_ms=12.3
```

The queries below target the configured `ContainerAppConsoleLogs_CL` custom
table. The exact custom-column suffix can vary by workspace ingestion schema;
verify the available columns in the Log Analytics Logs schema before saving a
query. The examples assume the message is in `Log_s` and the app name is in
`ContainerAppName_s`, as produced by Container Apps custom logs.

## Request count

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(7d)
| where ContainerAppName_s in ("sdd-3b-g7-wardrobe", "sdd-3b-g7-outfit")
| where Log_s matches regex @"method=[A-Z]+ path=\S+ status=\d+ duration_ms=[0-9.]+"
| summarize request_count=count() by ContainerAppName_s, bin(TimeGenerated, 1h)
| render timechart
```

## Error rate

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(7d)
| where ContainerAppName_s in ("sdd-3b-g7-wardrobe", "sdd-3b-g7-outfit")
| extend status = toint(extract(@"status=(\d+)", 1, Log_s))
| where isnotnull(status)
| summarize requests=count(), errors=countif(status >= 500) by bin(TimeGenerated, 1h), ContainerAppName_s
| extend error_rate = round(100.0 * errors / requests, 2)
| render timechart
```

## Response time (p50 and p95)

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(7d)
| where ContainerAppName_s in ("sdd-3b-g7-wardrobe", "sdd-3b-g7-outfit")
| extend duration_ms = todouble(extract(@"duration_ms=([0-9.]+)", 1, Log_s))
| where isnotnull(duration_ms)
| summarize p50_ms=percentile(duration_ms, 50), p95_ms=percentile(duration_ms, 95)
    by bin(TimeGenerated, 1h), ContainerAppName_s
| render timechart
```

## SLO: successful GET /items under 500 ms

Target: at least 99% of `GET /items` requests complete with a 2xx status and
`duration_ms < 500` over the previous seven days.

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(7d)
| where ContainerAppName_s == "sdd-3b-g7-wardrobe"
| where Log_s has "method=GET" and Log_s has "path=/items "
| extend status = toint(extract(@"status=(\d+)", 1, Log_s)),
         duration_ms = todouble(extract(@"duration_ms=([0-9.]+)", 1, Log_s))
| where isnotnull(status) and isnotnull(duration_ms)
| summarize total=count(), good=countif(status between (200 .. 299) and duration_ms < 500)
| extend slo_percent = 100.0 * good / total
```

This measures application request time only. It does not include browser
network time, Azure ingress time, or cold-start time before the request reaches
the application, and it is meaningful only when there are requests in the
window. Scale-to-zero cold starts may therefore make the user experience
slower than this SLO reports.

