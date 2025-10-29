(function (){
  'use strict';

  const opentelemetry = require('@opentelemetry/api');
  const { registerInstrumentations } = require('@opentelemetry/instrumentation');
  const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
  const { Resource } = require('@opentelemetry/resources');
  const { SEMRESATTRS_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
  const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

  // Configuration from environment variables
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'front-end';
  
  let provider = null;
  let isInitialized = false;
  let isShuttingDown = false;

  function initializeOtel() {
    // Guard against multiple initializations
    if (isInitialized) {
      console.log('OpenTelemetry already initialized, skipping');
      return provider;
    }

    // Only initialize if OTEL endpoint is configured
    if (!otelEndpoint) {
      console.log('OTEL endpoint not configured, skipping OpenTelemetry initialization');
      return null;
    }

    console.log(`Initializing OpenTelemetry with endpoint: ${otelEndpoint}`);

    try {
      // Configure trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
      });

      // Create tracer provider with resource
      provider = new NodeTracerProvider({
        resource: new Resource({
          [SEMRESATTRS_SERVICE_NAME]: serviceName,
        }),
        spanProcessors: [new SimpleSpanProcessor(traceExporter)],
      });

      // Register instrumentations with tracer provider
      registerInstrumentations({
        tracerProvider: provider,
        instrumentations: [
          // Express instrumentation expects HTTP layer to be instrumented
          new HttpInstrumentation({
            ignoreIncomingRequestHook: (req) => {
              if (!req.url) {
                return false;
              }
              // Ignore health check, metrics, and static asset endpoints
              const ignorePaths = ['/metrics', '/health', '/favicon.ico'];
              return ignorePaths.some(path => req.url.startsWith(path));
            },
          }),
          new ExpressInstrumentation({
            ignoreLayersType: ['middleware', 'router'],
          }),
        ],
      });

      // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
      provider.register();

      isInitialized = true;
      console.log('OpenTelemetry initialized successfully');

      return provider;
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
      return null;
    }
  }

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      if (provider) {
        provider.shutdown()
          .then(() => console.log('OpenTelemetry provider shut down successfully'))
          .catch((error) => {
            console.error('Error shutting down OpenTelemetry provider', error);
            process.exit(1);
          })
          .finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    }
  });

  module.exports = {
    initializeOtel,
    getTracer: () => opentelemetry.trace.getTracer('front-end'),
    sdk: () => provider, // For backward compatibility with tests
  };
}());
