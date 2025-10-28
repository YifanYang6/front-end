(function (){
  'use strict';

  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
  const { Resource } = require('@opentelemetry/resources');
  const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
  const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');

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
      // Configure trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
      });

      // Configure log exporter
      const logExporter = new OTLPLogExporter({
        url: `${otelEndpoint}/v1/logs`,
      });

      // Create SDK instance
      sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        }),
        traceExporter: traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Configure auto-instrumentations
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable filesystem instrumentation to reduce noise
            },
            '@opentelemetry/instrumentation-dns': {
              enabled: false, // Disable DNS instrumentation to prevent unnecessary root spans
            },
            '@opentelemetry/instrumentation-net': {
              enabled: false, // Disable NET instrumentation to prevent unnecessary tcp.connect root spans
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
