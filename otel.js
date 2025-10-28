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

  function initializeOtel() {
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
          }),
        ],
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
      });

      // Start the SDK
      sdk.start();
      console.log('OpenTelemetry initialized successfully');

      // Graceful shutdown
      process.on('SIGTERM', () => {
        sdk.shutdown()
          .then(() => console.log('OpenTelemetry SDK shut down successfully'))
          .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error))
          .finally(() => process.exit(0));
      });

      return sdk;
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
      return null;
    }
  }

  module.exports = {
    initializeOtel,
    sdk: () => sdk,
  };
}());
