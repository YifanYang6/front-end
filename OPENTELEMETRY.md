# OpenTelemetry Integration Guide

## Overview

This document explains the changes made to enable OpenTelemetry auto-instrumentation for this Node.js application and how to verify it's working correctly.

## Problem Statement

The original application was not producing OpenTelemetry traces or logs despite having the Kubernetes auto-instrumentation configured. This was due to several compatibility issues:

1. **Node.js Version**: The application used Node.js v4.8.0, which is incompatible with OpenTelemetry JS SDK (requires Node.js >= 14.0.0)
2. **Deprecated HTTP Client**: The application used the `request` library, which is deprecated and no longer supported by OpenTelemetry instrumentation
3. **Outdated Dependencies**: All dependencies were several major versions behind, causing compatibility issues

## Solution

### 1. Updated Node.js Version

**Changed in**: `Dockerfile`

```dockerfile
# Before
FROM node:10-alpine

# After  
FROM node:18-alpine
```

Node.js 18 is an LTS version with full OpenTelemetry support.

### 2. Replaced HTTP Client Library

**Changed in**: All API files, helpers, and tests

Replaced the deprecated `request` library with `axios`, which has native OpenTelemetry instrumentation support.

**Why Axios?**
- Modern, promise-based HTTP client
- Actively maintained
- Native OpenTelemetry instrumentation via `@opentelemetry/instrumentation-axios`
- Better error handling
- Smaller bundle size

### 3. Updated Dependencies

**Changed in**: `package.json`

Key updates:
- `axios`: ^1.6.7 (replaces `request`)
- `express`: ^4.18.2 (from ^4.13.4)
- `async`: ^3.2.5 (from ^1.5.2)
- `connect-redis`: ^7.1.0 (from ^3.2.0)
- `redis`: ^4.6.13 (new, required by connect-redis)
- All other dependencies updated to current stable versions

## Code Migration Examples

### Example 1: Simple GET Request

**Before (request)**:
```javascript
request(url, function (error, response, body) {
  if (error) {
    return next(error);
  }
  helpers.respondStatusBody(res, response.statusCode, body);
});
```

**After (axios)**:
```javascript
axios.get(url)
  .then(function(response) {
    helpers.respondStatusBody(res, response.status, 
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
  })
  .catch(function(error) {
    next(error);
  });
```

### Example 2: POST Request

**Before (request)**:
```javascript
var options = {
  uri: url,
  method: 'POST',
  json: true,
  body: data
};
request(options, function (error, response, body) {
  if (error) {
    return callback(error);
  }
  callback(null, response.statusCode);
});
```

**After (axios)**:
```javascript
axios.post(url, data)
  .then(function(response) {
    callback(null, response.status);
  })
  .catch(function(error) {
    callback(error);
  });
```

### Example 3: Stream Response

**Before (request)**:
```javascript
request.get(url)
  .on('error', function(e) { next(e); })
  .pipe(res);
```

**After (axios)**:
```javascript
axios.get(url, {responseType: 'stream'})
  .then(function(response) {
    response.data.pipe(res);
  })
  .catch(function(error) {
    next(error);
  });
```

## Kubernetes Deployment Configuration

The application now works with OpenTelemetry auto-instrumentation in Kubernetes. Here's the recommended configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: front-end
spec:
  template:
    metadata:
      annotations:
        # Enable OpenTelemetry auto-instrumentation
        instrumentation.opentelemetry.io/inject-nodejs: "monitoring/opentelemetry-kube-stack"
    spec:
      containers:
      - name: front-end
        image: weaveworksdemos/front-end:latest  # Use your updated image
        env:
        # Optional: Set log level for debugging
        - name: OTEL_LOG_LEVEL
          value: "info"  # Use "debug" for more verbose logging
        # Optional: Set service name
        - name: OTEL_SERVICE_NAME
          value: "front-end"
        # Optional: Set resource attributes
        - name: OTEL_RESOURCE_ATTRIBUTES
          value: "service.namespace=sockshop,service.version=1.0.0"
        ports:
        - containerPort: 8079
```

## Verifying OpenTelemetry Instrumentation

### 1. Check Init Container

After deployment, verify the init container was injected:

```bash
kubectl get pod <pod-name> -o jsonpath='{.spec.initContainers[*].name}'
```

Expected output: `opentelemetry-auto-instrumentation-nodejs`

### 2. Check Application Logs

View the application logs:

```bash
kubectl logs <pod-name> -c front-end
```

Look for OpenTelemetry initialization messages at startup.

### 3. Verify Environment Variables

Check that OpenTelemetry environment variables are set:

```bash
kubectl exec <pod-name> -c front-end -- env | grep OTEL
```

Expected variables:
- `OTEL_SERVICE_NAME`
- `OTEL_TRACES_EXPORTER`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `NODE_OPTIONS` (should include `--require /otel-auto-instrumentation/autoinstrumentation.js`)

### 4. Check Traces in Backend

Access your OpenTelemetry backend (e.g., Jaeger, Tempo, or your configured backend) and look for:
- Service name: `front-end` (or your configured name)
- Spans for HTTP requests
- Spans for outgoing HTTP calls to other services (catalogue, cart, orders, user)

Example trace structure you should see:
```
GET /catalogue
  ├─ GET http://catalogue/catalogue
  └─ GET http://carts/{custId}/items
```

### 5. Test with Sample Request

Make a request to the application:

```bash
kubectl port-forward svc/front-end 8080:80
curl http://localhost:8080/catalogue?size=5
```

Then check your tracing backend for the generated trace.

## Troubleshooting

### No Traces Appearing

1. **Check Init Container**: Verify it completed successfully
   ```bash
   kubectl describe pod <pod-name>
   ```

2. **Verify Node.js Version**: Should be >= 14
   ```bash
   kubectl exec <pod-name> -- node --version
   ```

3. **Check Auto-instrumentation**: Verify the instrumentation file exists
   ```bash
   kubectl exec <pod-name> -- ls -la /otel-auto-instrumentation/
   ```

4. **Check OTLP Endpoint**: Verify the backend endpoint is reachable
   ```bash
   kubectl exec <pod-name> -- env | grep OTEL_EXPORTER_OTLP_ENDPOINT
   ```

5. **Enable Debug Logging**: Set environment variable
   ```yaml
   env:
   - name: OTEL_LOG_LEVEL
     value: "debug"
   ```

### Traces Missing Some Spans

If you see the main HTTP request trace but not the outgoing calls:
- Verify axios instrumentation is loaded (should be automatic)
- Check that all outgoing HTTP calls use axios (not native http module)
- Ensure you're using the updated code from this PR

### High Memory Usage

If you experience increased memory usage:
1. Adjust sampling rate:
   ```yaml
   env:
   - name: OTEL_TRACES_SAMPLER
     value: "parentbased_traceidratio"
   - name: OTEL_TRACES_SAMPLER_ARG
     value: "0.1"  # Sample 10% of traces
   ```

2. Configure batch span processor:
   ```yaml
   env:
   - name: OTEL_BSP_MAX_QUEUE_SIZE
     value: "2048"
   - name: OTEL_BSP_MAX_EXPORT_BATCH_SIZE
     value: "512"
   ```

## Performance Impact

The changes have minimal performance impact:

1. **Axios vs Request**: Axios is faster and more efficient than request
2. **OpenTelemetry Overhead**: Typically < 5% CPU and < 50MB memory
3. **Promise-based Code**: Modern V8 engines optimize promises well

## Additional Resources

- [OpenTelemetry Node.js Documentation](https://opentelemetry.io/docs/instrumentation/js/)
- [OpenTelemetry Kubernetes Operator](https://github.com/open-telemetry/opentelemetry-operator)
- [Axios Instrumentation](https://www.npmjs.com/package/@opentelemetry/instrumentation-axios)
- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/concepts/instrumenting-library/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review OpenTelemetry operator logs
3. Verify the application logs for errors
4. Check your OpenTelemetry backend configuration
