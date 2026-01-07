import "@testing-library/jest-dom";
import 'openai/shims/node';

// Polyfill TextDecoder/TextEncoder
if (typeof global.TextDecoder === 'undefined') {
  const { TextDecoder, TextEncoder } = require('util');
  global.TextDecoder = TextDecoder;
  global.TextEncoder = TextEncoder;
}

// Polyfill ReadableStream
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
}

// Polyfill MessagePort (minimal implementation for undici)
if (typeof global.MessagePort === 'undefined') {
  class MessagePort {
    postMessage() {}
    start() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {}
  }
  global.MessagePort = MessagePort;
}

// Polyfill for Request/Response APIs in Node.js test environment
// Use undici which provides Web API compatibility
if (typeof global.Request === 'undefined') {
  const { Request, Response, Headers, fetch } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
  global.fetch = fetch;
}

