(function (){
  'use strict';

  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
  const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
  const { envDetector, hostDetector, osDetector, processDetector } = require('@opentelemetry/resources');

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

      // Create SDK instance with comprehensive instrumentation configuration
      sdk = new NodeSDK({
        serviceName: serviceName,
        traceExporter: traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable noisy instrumentations that create unnecessary spans
            '@opentelemetry/instrumentation-fs': {
              enabled: false,
            },
            '@opentelemetry/instrumentation-dns': {
              enabled: false,
            },
            '@opentelemetry/instrumentation-net': {
              enabled: false,
            },
            // Configure HTTP instrumentation to reduce middleware noise
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingRequestHook: (req) => {
                // Ignore health check and metrics endpoints
                if (!req.url) {
                  return false;
                }
                const ignorePaths = ['/metrics', '/health', '/favicon.ico'];
                return ignorePaths.some(path => req.url.startsWith(path));
              },
            },
            // Configure Express instrumentation to only show request handlers, not middleware
            '@opentelemetry/instrumentation-express': {
              ignoreLayersType: ['middleware', 'router'],
            },
          }),
        ],
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
        resourceDetectors: [
          envDetector,
          hostDetector,
          osDetector,
          processDetector,
        ],
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
