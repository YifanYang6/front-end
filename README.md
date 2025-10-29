[![Build Status](https://travis-ci.org/microservices-demo/front-end.svg?branch=master)](https://travis-ci.org/microservices-demo/front-end)
[![](https://images.microbadger.com/badges/image/weaveworksdemos/front-end.svg)](http://microbadger.com/images/weaveworksdemos/front-end "Get your own image badge on microbadger.com")
[![Actions Status](https://github.com/microservices-demo/front-end/workflows/ci/badge.svg)](https://github.com/microservices-demo/front-end/workflows/ci/badge.svg)


# DEPRECATED: Front-end app
---
Front-end application written in [Node.js](https://nodejs.org/en/) that puts together all of the microservices under [microservices-demo](https://github.com/microservices-demo/microservices-demo).

# Build

## Dependencies

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Version</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://docker.com">Docker</a></td>
      <td>>= 1.12</td>
    </tr>
    <tr>
      <td><a href="https://docs.docker.com/compose/">Docker Compose</a></td>
      <td>>= 1.8.0</td>
    </tr>
    <tr>
      <td><a href="gnu.org/s/make">Make</a>&nbsp;(optional)</td>
      <td>>= 4.1</td>
    </tr>
  </tbody>
</table>

## Node

`npm install`

## Docker

`make test-image`

## Docker Compose

`make up`

# Test

**Make sure that the microservices are up & running**

## Unit & Functional tests:

```
make test
```

## End-to-End tests:
  
To make sure that the test suite is running against the latest (local) version with your changes, you need to manually build
the image, run the container and attach it to the proper Docker networks.
There is a make task that will do all this for you:

```
make dev
```

That will also tail the logs of the container to make debugging easy.
Then you can run the tests with:

```
make e2e
```

# Run

## Node

`npm start`

## Docker

`make server`

# Configuration

## OpenTelemetry (OTEL)

The application supports OpenTelemetry for distributed tracing and log export. Configure it using environment variables:

### Basic Configuration

- `OTEL_EXPORTER_OTLP_ENDPOINT`: The OTLP endpoint URL (e.g., `http://localhost:4318`). If not set, OTEL is disabled.
- `OTEL_SERVICE_NAME`: The service name for telemetry (default: `front-end`)

### Instrumentation Control

Control which instrumentations are enabled using these environment variables:

- `OTEL_NODE_ENABLED_INSTRUMENTATIONS`: Comma-separated list of instrumentations to enable (e.g., `"http,express"`)
- `OTEL_NODE_DISABLED_INSTRUMENTATIONS`: Comma-separated list of instrumentations to disable (e.g., `"fs,dns,net"`)

**Note:** If both are set, `OTEL_NODE_ENABLED_INSTRUMENTATIONS` is applied first, then `OTEL_NODE_DISABLED_INSTRUMENTATIONS` is applied to that list.

### Logging

- `OTEL_LOG_LEVEL`: Set log level for troubleshooting (`none`, `error`, `warn`, `info`, `debug`, `verbose`, `all`). Default: `info`

### Recommended Configuration

For production, we recommend disabling noisy low-level instrumentations:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
export OTEL_SERVICE_NAME=front-end
export OTEL_NODE_DISABLED_INSTRUMENTATIONS="fs,dns,net"
export OTEL_LOG_LEVEL=info
npm start
```

Alternatively, to only enable specific instrumentations:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
export OTEL_SERVICE_NAME=front-end
export OTEL_NODE_ENABLED_INSTRUMENTATIONS="http,express"
export OTEL_LOG_LEVEL=info
npm start
```

This configuration:
- Enables only HTTP and Express instrumentations for cleaner traces
- Filters out health check, metrics, and favicon requests
- Ignores Express middleware and router layers (only request handlers are traced)
- Provides proper service identification with resource detectors

# Use

## Node

`curl http://localhost:8081`

## Docker Compose

`curl http://localhost:8080`

# Push

`GROUP=weaveworksdemos COMMIT=test ./scripts/push.sh`
