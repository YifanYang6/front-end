(function (){
  'use strict';

  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
  const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
  const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
  const { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } = require('@opentelemetry/core');

  // Configuration from environment variables
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'front-end';
  
  let sdk = null;
  let isInitialized = false;
  let isShuttingDown = false;

  function initializeOtel() {
    // Guard against multiple initializations
    if (isInitialized) {
      console.log('OpenTelemetry already initialized, skipping');
      return sdk;
    }

    // Only initialize if OTEL endpoint is configured
    if (!otelEndpoint) {
      console.log('OTEL endpoint not configured, skipping OpenTelemetry initialization');
      return null;
    }

    console.log(`Initializing OpenTelemetry with endpoint: ${otelEndpoint}`);

    try {
      // Configure trace exporter (gRPC uses the endpoint directly, no path suffix needed)
      const traceExporter = new OTLPTraceExporter({
        url: otelEndpoint,
      });

      // Configure log exporter (gRPC uses the endpoint directly, no path suffix needed)
      const logExporter = new OTLPLogExporter({
        url: otelEndpoint,
      });

      // Configure propagators to ensure trace context propagation to Java backend
      // Using W3C TraceContext (traceparent) and W3C Baggage for compatibility
      const propagator = new CompositePropagator({
        propagators: [
          new W3CTraceContextPropagator(),
          new W3CBaggagePropagator(),
        ],
      });

      // Create SDK instance
      sdk = new NodeSDK({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: serviceName,
        }),
        traceExporter: traceExporter,
        textMapPropagator: propagator,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Configure auto-instrumentations
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable filesystem instrumentation to reduce noise
            },
            '@opentelemetry/instrumentation-express': {
              ignoreLayersType: ['middleware'], // Ignore middleware layers
            },
            '@opentelemetry/instrumentation-dns': {
              enabled: false, // Disable DNS instrumentation
            },
            '@opentelemetry/instrumentation-net': {
              enabled: false, // Disable net instrumentation
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true, // Enable http instrumentation for root spans and trace propagation
            },
          }),
        ],
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
      });

      // Start the SDK
      sdk.start();
      isInitialized = true;
      console.log('OpenTelemetry initialized successfully');

      return sdk;
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
      return null;
    }
  }

  // Graceful shutdown handler - registered once at module load
  process.on('SIGTERM', () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      if (sdk) {
        sdk.shutdown()
          .then(() => console.log('OpenTelemetry SDK shut down successfully'))
          .catch((error) => {
            console.error('Error shutting down OpenTelemetry SDK', error);
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
    sdk: () => sdk,
  };
}());
