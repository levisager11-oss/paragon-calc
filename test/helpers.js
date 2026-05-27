/**
 * Minimal Express-style req/res mock for testing Vercel serverless handlers.
 */

export function makeReqRes({ method = "POST", body = {}, headers = {} } = {}) {
  const req = {
    method,
    body,
    headers: { ...headers },
    socket: { remoteAddress: "127.0.0.1" },
  };

  const res = {
    statusCode: 200,
    _headers: {},
    _body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this._headers[key.toLowerCase()] = String(val);
      return this;
    },
    getHeader(key) {
      return this._headers[key.toLowerCase()];
    },
    json(data) {
      this._body = data;
      return this;
    },
    end() {
      return this;
    },
  };

  return { req, res };
}
