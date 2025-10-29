(function (){
  'use strict';

  const opentelemetry = require('@opentelemetry/api');
  const { registerInstrumentations } = require('@opentelemetry/instrumentation');
  const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
  const { Resource } = require('@opentelemetry/resources');
  const { SEMRESATTRS_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

  // Configuration from environment variables
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'front-end';
  
  let provider = null;
  let isInitialized = false;
  let isShuttingDown = false;

  async function initializeOtel() {
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

      // Create base resource with service name
      const baseResource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
      });

      // Detect additional resource attributes
      const detectedResource = await Resource.default()
        .merge(baseResource);

      // Create tracer provider with merged resource
      provider = new NodeTracerProvider({
        resource: detectedResource,
      });

      // Add span processor with batch exporter
      provider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

      // Register the provider to make it available globally
      provider.register();

      // Register instrumentations with custom configuration
      registerInstrumentations({
        instrumentations: [
          // HTTP instrumentation with filtering
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
          // Express instrumentation with middleware filtering
          new ExpressInstrumentation({
            ignoreLayersType: ['middleware', 'router'],
          }),
        ],
      });

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
