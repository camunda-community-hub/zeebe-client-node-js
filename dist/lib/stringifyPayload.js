"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function stringifyPayload(request) {
    const payload = request.payload || {};
    const payloadString = JSON.stringify(payload);
    return Object.assign({}, request, { payload: payloadString });
}
exports.stringifyPayload = stringifyPayload;
function parsePayload(response) {
    return Object.assign({}, response, { payload: JSON.parse(response.payload) });
}
exports.parsePayload = parsePayload;
//# sourceMappingURL=stringifyPayload.js.map