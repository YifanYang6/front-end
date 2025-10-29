var expect = require("chai").expect;

describe("otel", function() {
  var otel;

  beforeEach(function() {
    // Clear the module cache to ensure fresh require
    delete require.cache[require.resolve("../otel")];
  });

  afterEach(function() {
    // Cleanup
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SERVICE_NAME;
  });

  describe("#initializeOtel", function() {
    it("should not initialize when OTEL_EXPORTER_OTLP_ENDPOINT is not set", async function() {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      otel = require("../otel");
      var sdk = await otel.initializeOtel();
      expect(sdk).to.be.null;
    });

    it("should initialize when OTEL_EXPORTER_OTLP_ENDPOINT is set", async function() {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      otel = require("../otel");
      var sdk = await otel.initializeOtel();
      expect(sdk).to.not.be.null;
      // Cleanup: shutdown the SDK
      if (sdk) {
        await sdk.shutdown();
      }
    });

    it("should not initialize twice when called multiple times", async function() {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      otel = require("../otel");
      var sdk1 = await otel.initializeOtel();
      var sdk2 = await otel.initializeOtel();
      expect(sdk1).to.equal(sdk2);
      // Cleanup: shutdown the SDK
      if (sdk1) {
        await sdk1.shutdown();
      }
    });

    it("should use default service name when OTEL_SERVICE_NAME is not set", async function() {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      delete process.env.OTEL_SERVICE_NAME;
      otel = require("../otel");
      var sdk = await otel.initializeOtel();
      expect(sdk).to.not.be.null;
      // Cleanup: shutdown the SDK
      if (sdk) {
        await sdk.shutdown();
      }
    });

    it("should use custom service name when OTEL_SERVICE_NAME is set", async function() {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      process.env.OTEL_SERVICE_NAME = "custom-service";
      otel = require("../otel");
      var sdk = await otel.initializeOtel();
      expect(sdk).to.not.be.null;
      // Cleanup: shutdown the SDK
      if (sdk) {
        await sdk.shutdown();
      }
    });
  });

  describe("#sdk", function() {
    it("should return the SDK instance after initialization", async function() {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      otel = require("../otel");
      await otel.initializeOtel();
      var sdk = otel.sdk();
      expect(sdk).to.not.be.null;
      // Cleanup: shutdown the SDK
      if (sdk) {
        await sdk.shutdown();
      }
    });

    it("should return null when not initialized", async function() {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      otel = require("../otel");
      await otel.initializeOtel();
      var sdk = otel.sdk();
      expect(sdk).to.be.null;
    });
  });
});
